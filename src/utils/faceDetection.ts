// Client-side face detection (YuNet, ONNX) for the local person search.
//
// Everything here runs in the browser and nothing leaves the device — that is
// the point of the feature, not an optimisation. See
// docs/legal/personensuche-umsetzungsplan.md § 3 (Architekturregeln) and § 5.4.
//
// Design mirrors utils/embedding.ts: lazy singleton, serialised inference, and
// a soft failure that returns an empty result instead of throwing — a person
// search that cannot start must not break the normal photo analysis.
//
// WASM only, not "WebGPU when available" — reported 2026-08-19: a reference
// photo that should trivially detect (clear, frontal, well-lit) silently
// found nothing, on a device where the same feature had worked before. The
// onnxruntime-web WebGPU execution provider is far less mature than WASM for
// a custom exported graph like this one; unlike a slow path, a broken one
// degrades in total silence (the soft-failure design above catches it and
// just returns []), which is exactly what makes it worth not risking for a
// single reference-photo inference where WASM's speed is already a non-issue.
//
// Model: YuNet 2023mar re-exported with dynamic input dims (2026may),
// MIT-licensed, self-hosted under /models/yunet. Weights and provenance:
// public/models/yunet/{LICENSE,face_detection_yunet_2026may.onnx}.

import type { InferenceSession, Tensor as OrtTensor } from 'onnxruntime-web';
import { serializeInference } from './inferenceSerializer';

/** A detected face in the coordinate space of the bitmap that was passed in. */
export interface FaceBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  /** 5 landmarks: right eye, left eye, nose, right mouth corner, left mouth corner. */
  landmarks: [number, number][];
}

const MODEL_URL = '/models/yunet/face_detection_yunet_2026may.onnx';

// The plan (§ 2.6/§ 9.5) requires detection on a LARGE, UNCROPPED bitmap: the
// 512px centre-cropped thumbnail loses people at the frame edge entirely and
// leaves background faces at 15-40px. 1600px long edge is what the spike
// measured against, so the accuracy numbers in the report only hold at this size.
const DETECT_LONG_EDGE = 1600;

// The FPN neck adds feature maps of strides 8/16/32, so both input dimensions
// must be divisible by 32 — otherwise the levels have mismatched sizes and the
// graph fails in an Add node. Padding right/bottom keeps the origin at (0,0),
// so decoded coordinates stay valid for the unpadded image.
const SIZE_DIVISOR = 32;

const STRIDES = [8, 16, 32] as const;

// Lower than OpenCV's demo default of 0.9, deliberately: on the plan's
// intentionally hard test set 0.9 rejected even a clean, centred, well-lit
// reference portrait (score 0.893). 0.5 is what the spike measured with.
const DEFAULT_SCORE_THRESHOLD = 0.5;
const DEFAULT_NMS_THRESHOLD = 0.3;

let sessionPromise: Promise<InferenceSession | null> | null = null;

async function getOrt() {
  const ort = await import('onnxruntime-web');
  // Serve the runtime's own WASM artifacts from our origin. Measured 13.08.2026
  // (spike § 6): without this, onnxruntime-web resolves them RELATIVE TO THE URL
  // OF ITS OWN SCRIPT — so self-hosting the bundle already protects us, and this
  // line is the second lock. It becomes load-bearing the moment anyone switches
  // to a CDN-hosted ort build, which is the common quickstart pattern.
  ort.env.wasm.wasmPaths = '/ort/';
  return ort;
}

async function getSession(): Promise<InferenceSession | null> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    try {
      const ort = await getOrt();
      // WASM only, deliberately — see the note at the top of the file.
      return await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
    } catch (err) {
      console.warn('[faceDetection] model load failed — person search unavailable:', err);
      return null;
    }
  })();
  return sessionPromise;
}

/**
 * Load the detector without running it. Call this before starting a person
 * search run so the network activity happens up front — § 5.4 requires that no
 * request goes out *during* matching, which is only provable if loading is a
 * separate, completed step.
 */
export async function preloadFaceDetector(): Promise<boolean> {
  return (await getSession()) !== null;
}

// Serialised against every other on-device model too (CLIP, FaceNet), not just
// against itself. This used to be a private chain, deliberately separate from
// embedding.ts's — reasoned only about wall-clock timing being "meaningless"
// under overlap, not about correctness. That was wrong: confirmed 2026-08-14,
// running this concurrently with the CLIP pass in useUpload.ts's MAX_CONCURRENT
// pipeline reliably corrupts the shared onnxruntime-web WASM runtime ("Session
// already started", then an uncatchable "memory access out of bounds" trap).
// See utils/inferenceSerializer.ts.

/** Detect faces in a bitmap. Returns [] if the model is unavailable. */
export function detectFaces(
  bitmap: ImageBitmap,
  opts?: { scoreThreshold?: number; nmsThreshold?: number }
): Promise<FaceBox[]> {
  return serializeInference(() => detectNow(bitmap, opts));
}

async function detectNow(
  bitmap: ImageBitmap,
  opts?: { scoreThreshold?: number; nmsThreshold?: number }
): Promise<FaceBox[]> {
  const session = await getSession();
  if (!session) return [];

  const scoreThreshold = opts?.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  const nmsThreshold = opts?.nmsThreshold ?? DEFAULT_NMS_THRESHOLD;

  try {
    const ort = await getOrt();
    const { pixels, width, height, scale } = drawScaled(bitmap, DETECT_LONG_EDGE);

    const padW = Math.ceil(width / SIZE_DIVISOR) * SIZE_DIVISOR;
    const padH = Math.ceil(height / SIZE_DIVISOR) * SIZE_DIVISOR;

    // RGBA (canvas) → BGR CHW float32, zero-padded. No normalisation: the
    // training pipeline used mean 0 / std 1 and to_rgb=false, i.e. raw BGR 0-255.
    const chw = new Float32Array(3 * padH * padW);
    const plane = padH * padW;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const s = (y * width + x) * 4;
        const d = y * padW + x;
        chw[d] = pixels[s + 2];
        chw[plane + d] = pixels[s + 1];
        chw[2 * plane + d] = pixels[s];
      }
    }

    const feeds: Record<string, OrtTensor> = {
      input: new ort.Tensor('float32', chw, [1, 3, padH, padW]),
    };
    const out = await session.run(feeds);

    const dets: FaceBox[] = [];
    for (const stride of STRIDES) {
      const featW = padW / stride;
      const featH = padH / stride;
      const cls = out[`cls_${stride}`].data as Float32Array;
      const obj = out[`obj_${stride}`].data as Float32Array;
      const bbox = out[`bbox_${stride}`].data as Float32Array;
      const kps = out[`kps_${stride}`].data as Float32Array;

      for (let i = 0; i < featH * featW; i++) {
        // cls/obj are ALREADY post-sigmoid in this export: the training repo
        // applies .sigmoid() inside `if torch.onnx.is_in_onnx_export()` before
        // naming the outputs. Applying it again silently halves every score and
        // makes the detector find nothing.
        const score = cls[i] * obj[i];
        if (score < scoreThreshold) continue;

        const px = (i % featW) * stride;
        const py = Math.floor(i / featW) * stride;

        const cx = bbox[i * 4] * stride + px;
        const cy = bbox[i * 4 + 1] * stride + py;
        const w = Math.exp(bbox[i * 4 + 2]) * stride;
        const h = Math.exp(bbox[i * 4 + 3]) * stride;

        // Drop detections centred in the zero-padded margin.
        if (cx >= width || cy >= height) continue;

        const landmarks: [number, number][] = [];
        for (let k = 0; k < 5; k++) {
          landmarks.push([
            (kps[i * 10 + k * 2] * stride + px) / scale,
            (kps[i * 10 + k * 2 + 1] * stride + py) / scale,
          ]);
        }

        // Back to the ORIGINAL bitmap's coordinate space, so callers can crop
        // faces from full resolution rather than from this downscaled copy (§ 9.5).
        dets.push({
          x1: Math.max(0, cx - w / 2) / scale,
          y1: Math.max(0, cy - h / 2) / scale,
          x2: Math.min(width, cx + w / 2) / scale,
          y2: Math.min(height, cy + h / 2) / scale,
          score,
          landmarks,
        });
      }
    }

    dets.sort((a, b) => b.score - a.score);
    return nonMaxSuppression(dets, nmsThreshold);
  } catch (err) {
    console.warn('[faceDetection] detect failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Draw the bitmap into a canvas at most `longEdge` px on its longer side. */
function drawScaled(
  bitmap: ImageBitmap,
  longEdge: number
): { pixels: Uint8ClampedArray; width: number; height: number; scale: number } {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = (canvas as OffscreenCanvas | HTMLCanvasElement).getContext('2d', {
    willReadFrequently: true,
  }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('2d context unavailable');

  ctx.drawImage(bitmap, 0, 0, width, height);
  return { pixels: ctx.getImageData(0, 0, width, height).data, width, height, scale };
}

function iou(a: FaceBox, b: FaceBox): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

/** Expects `dets` sorted by score, descending. */
function nonMaxSuppression(dets: FaceBox[], threshold: number): FaceBox[] {
  const kept: FaceBox[] = [];
  for (const det of dets) {
    if (kept.every((k) => iou(k, det) < threshold)) kept.push(det);
  }
  return kept;
}
