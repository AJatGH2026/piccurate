// Client-side CLIP image embeddings via transformers.js. Used for cross-camera
// near-duplicate detection — the same scene shot by different people/cameras,
// which perceptual hashing (pHash) can't recognise because viewpoint, framing,
// colour and resolution all differ. A semantic embedding maps such shots close
// together regardless.
//
// Design:
// - Lazy singleton: the model (~tens of MB, browser-cached) loads only on first
//   use. WebGPU when available, else WASM.
// - Serialised: inferences run one at a time (a global promise chain) so we
//   don't spawn parallel model runs.
// - Graceful: any failure returns null; series detection then falls back to
//   pHash, so nothing breaks if the model can't load.

type Extractor = (
  input: string,
  opts?: Record<string, unknown>
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<Extractor | null> | null = null;

async function getExtractor(): Promise<Extractor | null> {
  if (extractorPromise) return extractorPromise;
  extractorPromise = (async () => {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const device =
        typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
      const pipe = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
        dtype: 'q8', // quantized → smaller download, faster
        device,
      });
      return pipe as unknown as Extractor;
    } catch (err) {
      console.warn('[embedding] model load failed — dedup falls back to pHash:', err);
      return null;
    }
  })();
  return extractorPromise;
}

// Serialise inference: model runs are heavy and not reentrant-safe.
let chain: Promise<unknown> = Promise.resolve();

/** Compute a unit-normalised CLIP embedding for an image blob (or null on failure). */
export function computeEmbedding(blob: Blob): Promise<number[] | null> {
  const run = () => computeNow(blob);
  const result = chain.then(run, run);
  chain = result.catch(() => {});
  return result;
}

async function computeNow(blob: Blob): Promise<number[] | null> {
  const extractor = await getExtractor();
  if (!extractor) return null;
  const url = URL.createObjectURL(blob);
  try {
    const out = await extractor(url, { pooling: 'mean', normalize: true });
    const arr = Array.from(out.data as Float32Array);
    if (!arr.length) return null;
    // Ensure unit length so cosine similarity == dot product.
    let norm = 0;
    for (const v of arr) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    return arr.map((v) => v / norm);
  } catch (err) {
    console.warn('[embedding] compute failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Cosine similarity of two unit-normalised embeddings (dot product). 0 if missing. */
export function cosineSim(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
