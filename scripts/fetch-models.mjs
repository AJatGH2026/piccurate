// Fetches the face-recognition model weights into public/models/ before a build.
//
// Why not commit them: the FaceNet export is ~45 MB. This repo is public, and
// binaries in git history are permanent — the repo already had to be deleted and
// recreated once because unwanted objects would not go away. Weights therefore
// live in a private Vercel Blob store and are pulled in at build time.
//
// Why still into public/ and not fetched by the browser from the Blob store:
// § 3 rule 4 and § 5.4 of docs/legal/personensuche-umsetzungsplan.md require the
// models to come from OUR origin, with no third-party request while the person
// search runs. blob.vercel-storage.com is a different origin. So the Blob store
// is a BUILD-TIME source only; at runtime the files are plain static assets.
//
// The store is private on purpose: the download URLs live in this file, which is
// world-readable, and a public 45 MB blob would be an open invitation to burn
// somebody else's bandwidth.
//
// Local development: if the files are already present and their checksums match,
// nothing is downloaded and no token is needed.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// sha256 pins the exact artifact. Without it a swapped blob would silently ship
// a different model — and "the matching got worse" is a needle nobody would
// think to look for in the build pipeline.
const MODELS = [
  {
    pathname: 'models/yunet/face_detection_yunet_2026may.onnx',
    dest: 'public/models/yunet/face_detection_yunet_2026may.onnx',
    sha256: 'ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0',
    bytes: 229738,
  },
  {
    pathname: 'models/facenet/facenet_vggface2_fp16.onnx',
    dest: 'public/models/facenet/facenet_vggface2_fp16.onnx',
    sha256: '88d0056a5a849abae072dff76c72f9843d1390f051f3b7403059bd5bc04e39bf',
    bytes: 47049346,
  },
];

const BLOB_BASE = 'https://muti5xsoahpmkdvq.private.blob.vercel-storage.com/';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function alreadyGood(dest, expected) {
  const abs = path.join(root, dest);
  if (!existsSync(abs)) return false;
  try {
    return sha256(await readFile(abs)) === expected;
  } catch {
    return false;
  }
}

async function download(model, token) {
  if (!token) {
    throw new Error(
      `BLOB_READ_WRITE_TOKEN fehlt — ${model.dest} ist lokal nicht vorhanden und kann nicht geladen werden.\n` +
        `  Auf Vercel wird der Token durch den verbundenen Blob-Store automatisch gesetzt.\n` +
        `  Lokal: "vercel env pull" oder den Wert aus dem Vercel-Dashboard in .env.local eintragen.`
    );
  }
  const res = await fetch(BLOB_BASE + model.pathname, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status} ${res.statusText}): ${model.pathname}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const actual = sha256(buf);
  if (actual !== model.sha256) {
    // Hard stop. A wrong model file does not crash — it just quietly makes the
    // person search worse, which is the hardest kind of bug to trace back here.
    throw new Error(
      `Prüfsumme weicht ab für ${model.pathname}\n  erwartet: ${model.sha256}\n  erhalten: ${actual}`
    );
  }

  const abs = path.join(root, model.dest);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return buf.length;
}

// .env.local is not loaded automatically in a plain node script.
async function tokenFromEnvFile() {
  const p = path.join(root, '.env.local');
  if (!existsSync(p)) return null;
  for (const line of (await readFile(p, 'utf8')).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    if (trimmed.slice(0, i).trim() === 'BLOB_READ_WRITE_TOKEN') {
      return trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const token = process.env.BLOB_READ_WRITE_TOKEN || (await tokenFromEnvFile());

let downloaded = 0;
for (const model of MODELS) {
  if (await alreadyGood(model.dest, model.sha256)) {
    console.log(`[fetch-models] ${model.dest} vorhanden und geprüft`);
    continue;
  }
  const size = await download(model, token);
  downloaded += size;
  console.log(`[fetch-models] ${model.dest} geladen (${(size / 1024 / 1024).toFixed(1)} MB, Prüfsumme ok)`);
}

console.log(
  downloaded
    ? `[fetch-models] fertig, ${(downloaded / 1024 / 1024).toFixed(1)} MB geladen`
    : '[fetch-models] fertig, nichts zu laden'
);
