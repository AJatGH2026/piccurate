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
import { recordPhase } from './upload-timing';

let chain: Promise<unknown> = Promise.resolve();

// Give the browser one frame between two consecutive inferences. Every call
// in this chain (CLIP, YuNet, FaceNet) is a WASM session.run() with no
// worker/proxy — see the device-selection notes in embedding.ts and
// faceDetection.ts — so it blocks the main thread for its own duration.
// Reported 2026-08-29: on a 249-photo mobile upload, back-to-back-to-back
// calls with no gap between them starve React's render queue for the whole
// run, so the grid/progress bar appear frozen and then jump once the batch
// finally drains, rather than filling in as photos actually finish. This
// does not shorten total inference time — it only lets the UI (and touch
// input) catch up between calls, which is what "frozen, then jumps" needs.
function yieldToMain(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run `fn` only after every previously queued inference call (from ANY of the
 * three models) has settled. Errors are swallowed for the purpose of
 * unblocking the queue — same as before, callers still see their own
 * rejection via the returned promise.
 */
export function serializeInference<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  // Split into WAIT (queued behind other models) and RUN (this model actually
  // computing) — the two call for opposite fixes, and telling them apart is the
  // whole point of the measurement. See utils/upload-timing.ts.
  const queuedAt = label ? Date.now() : 0;
  const timed = label
    ? async () => {
        recordPhase(`${label}_wait`, Date.now() - queuedAt);
        const startedAt = Date.now();
        try {
          return await fn();
        } finally {
          recordPhase(`${label}_run`, Date.now() - startedAt);
        }
      }
    : fn;
  const result = chain.then(timed, timed);
  chain = result.then(
    () => yieldToMain(),
    () => yieldToMain()
  );
  return result;
}
