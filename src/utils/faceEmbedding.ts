// Client-side face embeddings (FaceNet InceptionResnetV1, VGGFace2) for the
// local person search. Runs entirely in the browser; no crop, embedding or
// match score ever leaves the device (§ 3 Architekturregel 3, § 5.4).
//
// Model: exported from timesler/facenet-pytorch (MIT, VGGFace2 weights) and
// converted to fp16. Provenance and the size/accuracy measurements that led to
// fp16: public/models/facenet/PROVENANCE.md.

import type { InferenceSession, Tensor as OrtTensor } from 'onnxruntime-web';
import type { FaceBox } from './faceDetection';
import { serializeInference } from './inferenceSerializer';

// fp16 rather than fp32 (89.6 MB) or int8 (22.8 MB): measured over all 309 test
// photos, fp16 reproduces the fp32 accuracy exactly (identical operating points,
// cosine 0.999999 to the original vectors) at half the size, while int8 costs
// 3.5 points of recall — and recall is already the binding constraint.
const MODEL_URL = '/models/facenet/facenet_vggface2_fp16.onnx';

/** FaceNet's input size. Not negotiable — the network is fixed at 160x160. */
const CROP_SIZE = 160;

// A plain box crop with a small margin, deliberately NOT a landmark-aligned
// warp. Measured (spike § 4.7): both a 2-point eye alignment and a full 5-point
// least-squares (Umeyama) alignment made results WORSE, because FaceNet was
// itself trained on loose MTCNN box crops — any tighter alignment moves the
// input away from its training regime. dlib behaves the opposite way, so this
// constant travels with the model and must be re-measured if the model changes.
const CROP_MARGIN = 0.15;

let sessionPromise: Promise<InferenceSession | null> | null = null;

async function getOrt() {
  const ort = await import('onnxruntime-web');
  ort.env.wasm.wasmPaths = '/ort/';
  return ort;
}

async function getSession(): Promise<InferenceSession | null> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    try {
      const ort = await getOrt();
      const providers =
        typeof navigator !== 'undefined' && 'gpu' in navigator ? ['webgpu', 'wasm'] : ['wasm'];
      return await ort.InferenceSession.create(MODEL_URL, { executionProviders: providers });
    } catch (err) {
      console.warn('[faceEmbedding] model load failed — person search unavailable:', err);
      return null;
    }
  })();
  return sessionPromise;
}

/** Load the embedder up front, so § 5.4's "no requests during matching" holds. */
export async function preloadFaceEmbedder(): Promise<boolean> {
  return (await getSession()) !== null;
}

// Serialised against every other on-device model too (CLIP, YuNet), not just
// against itself — see utils/inferenceSerializer.ts for why a shared chain
// replaced what used to be three independent per-module ones.

/**
 * Embed one detected face. `box` must be in `bitmap`'s coordinate space; the
 * crop is taken from the bitmap at FULL resolution rather than from a
 * downscaled detection copy (§ 9.5), which matters for small faces.
 *
 * Returns null on failure — callers treat that as "no match information".
 */
export function computeFaceEmbedding(bitmap: ImageBitmap, box: FaceBox): Promise<number[] | null> {
  return serializeInference(() => embedNow(bitmap, box));
}

async function embedNow(bitmap: ImageBitmap, box: FaceBox): Promise<number[] | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const ort = await getOrt();
    const pixels = cropFace(bitmap, box);

    // RGBA → RGB CHW, standardised as (x - 127.5) / 128. Exact formula from
    // facenet_pytorch's fixed_image_standardization; the exported graph has no
    // normalisation layer of its own, so getting this wrong silently degrades
    // every embedding rather than failing loudly.
    const chw = new Float32Array(3 * CROP_SIZE * CROP_SIZE);
    const plane = CROP_SIZE * CROP_SIZE;
    for (let i = 0; i < plane; i++) {
      const s = i * 4;
      chw[i] = (pixels[s] - 127.5) / 128;
      chw[plane + i] = (pixels[s + 1] - 127.5) / 128;
      chw[2 * plane + i] = (pixels[s + 2] - 127.5) / 128;
    }

    const feeds: Record<string, OrtTensor> = {
      input: new ort.Tensor('float32', chw, [1, 3, CROP_SIZE, CROP_SIZE]),
    };
    const out = await session.run(feeds);
    const data = out.embedding.data as Float32Array;
    if (!data?.length) return null;

    // Unit-normalise so cosine similarity is a plain dot product downstream.
    const vec = Array.from(data);
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    return vec.map((v) => v / norm);
  } catch (err) {
    console.warn('[faceEmbedding] embed failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Crop `box` (plus margin) from the bitmap and scale it to CROP_SIZE². */
function cropFace(bitmap: ImageBitmap, box: FaceBox): Uint8ClampedArray {
  const bw = box.x2 - box.x1;
  const bh = box.y2 - box.y1;
  const sx = box.x1 - bw * CROP_MARGIN;
  const sy = box.y1 - bh * CROP_MARGIN;
  const sw = bw * (1 + 2 * CROP_MARGIN);
  const sh = bh * (1 + 2 * CROP_MARGIN);

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(CROP_SIZE, CROP_SIZE)
      : Object.assign(document.createElement('canvas'), { width: CROP_SIZE, height: CROP_SIZE });
  const ctx = (canvas as OffscreenCanvas | HTMLCanvasElement).getContext('2d', {
    willReadFrequently: true,
  }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('2d context unavailable');

  // drawImage clamps a source rectangle that runs past the bitmap edge, which is
  // what we want for faces at the frame border: the margin simply gets cut short
  // instead of the call failing.
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, CROP_SIZE, CROP_SIZE);
  return ctx.getImageData(0, 0, CROP_SIZE, CROP_SIZE).data;
}

/** Cosine similarity of two unit-normalised face embeddings. 0 if missing. */
export function faceSimilarity(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Average several reference embeddings of the same person into one.
 *
 * Measured (spike § 4.3a): three reference photos lift the main number from
 * 0.611 to 0.709 and the exclude-mode figure from 0.491 to 0.653; five bring
 * nothing further. Averaging is correct HERE only because these vectors are
 * unit-normalised and compared by cosine — the same trick applied to dlib's
 * unnormalised descriptors with Euclidean distance destroys them.
 */
export function averageEmbeddings(embeddings: number[][]): number[] | null {
  const valid = embeddings.filter((e) => e?.length);
  if (!valid.length) return null;
  const dim = valid[0].length;
  const avg = new Array<number>(dim).fill(0);
  for (const e of valid) {
    if (e.length !== dim) continue;
    for (let i = 0; i < dim; i++) avg[i] += e[i] / valid.length;
  }
  let norm = 0;
  for (const v of avg) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return avg.map((v) => v / norm);
}
