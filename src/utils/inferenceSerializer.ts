// Shared serialisation for every browser-side model in this app: CLIP
// (utils/embedding.ts, via transformers.js), YuNet face detection
// (utils/faceDetection.ts) and FaceNet face embedding (utils/faceEmbedding.ts).
//
// Each of those three used to keep its OWN private serialisation chain — safe
// against itself, but deliberately allowed to run concurrently against the
// other two, on the theory that only wall-clock timing was at stake (see the
// removed comments in faceDetection.ts/faceEmbedding.ts). That theory was
// wrong. Confirmed 2026-08-14: with useUpload.ts's MAX_CONCURRENT=4 photo
// pipeline, running the face pass (YuNet → FaceNet) concurrently with the
// fire-and-forget CLIP pass reliably reproduces a real crash — first
// "Session already started" (onnxruntime-web's own re-entrancy guard, caught
// and logged), then an uncatchable "RuntimeError: memory access out of
// bounds" WASM trap that kills the tab. All three modules ultimately share one
// onnxruntime-web WASM runtime; it is not safe for two of its sessions to run
// truly concurrently, regardless of which JS-level session object issued the
// call. One shared chain instead of three independent ones is the fix.
let chain: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` only after every previously queued inference call (from ANY of the
 * three models) has settled. Errors are swallowed for the purpose of
 * unblocking the queue — same as before, callers still see their own
 * rejection via the returned promise.
 */
export function serializeInference<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(fn, fn);
  chain = result.catch(() => {});
  return result;
}
