// Copies the ONNX Runtime Web WASM artifacts into public/ort/ so they are
// served from OUR origin.
//
// Why a copy step at all: Next.js does not serve files out of node_modules, and
// the runtime fetches these files at session-create time. Measured 13.08.2026
// (see docs/legal/personensuche-spike-messbericht.md § 6): onnxruntime-web
// resolves them relative to the URL of its own script, so a CDN-hosted runtime
// silently pulls its WASM from that CDN too. That would put a third-party
// request inside the very window § 5.4 of the person-search plan requires to be
// request-free. Self-hosting is the fix; utils/faceDetection.ts additionally
// pins ort.env.wasm.wasmPaths to '/ort/' as a second lock.
//
// public/ort/ is gitignored and regenerated — these are ~39 MB of binaries that
// have no business in a public repo's history.

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dest = path.join(root, 'public', 'ort');

// Both the plain and the JSEP (WebGPU-capable) builds: which one the runtime
// picks depends on the execution provider the browser ends up with, and a
// missing file only surfaces at runtime on the device that needed it.
const NEEDED = [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
];

if (!existsSync(src)) {
  console.error(`[copy-ort-assets] ${src} fehlt — onnxruntime-web nicht installiert?`);
  process.exit(1);
}

await mkdir(dest, { recursive: true });

const available = new Set(await readdir(src));
const missing = NEEDED.filter((f) => !available.has(f));
if (missing.length) {
  // Hard failure: a silently missing artifact turns into "person search does
  // nothing" on some devices, which is far harder to diagnose than a build error.
  console.error(`[copy-ort-assets] fehlende Dateien in onnxruntime-web/dist: ${missing.join(', ')}`);
  process.exit(1);
}

for (const file of NEEDED) {
  await copyFile(path.join(src, file), path.join(dest, file));
}

console.log(`[copy-ort-assets] ${NEEDED.length} Dateien nach public/ort/ kopiert`);
