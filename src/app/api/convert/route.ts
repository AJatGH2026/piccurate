import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';

const execFileAsync = promisify(execFile);

// Generous per-IP limit: a legit upload of a 250-photo HEIC album fires many
// convert calls in a burst, so this must sit well above that while still
// capping a sustained abuse/DoS loop. Backed by Upstash when configured.
const CONVERT_RL_LIMIT = 400;
const CONVERT_RL_WINDOW_MS = 60_000;

export const maxDuration = 30;
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
const THUMBNAIL_SIZE = 512;
const THUMBNAIL_QUALITY = 70; // 0-100

// Third output mode, for the local person search: a LARGE, UNCROPPED image.
// The 512 thumbnail is a centre-cropped square, so anybody at the edge of the
// frame is cut away entirely and background faces are 15–40 px — useless for
// face detection (§ 2.6 / § 9.5 of docs/legal/personensuche-umsetzungsplan.md).
// 1600 px long edge is the size the spike's accuracy numbers were measured at.
//
// Cost note: ~250–400 KB per photo instead of ~30 KB. Only requested when the
// user actually activated the person search, so photo sets without it are
// unaffected — that ratio is why the mode is opt-in rather than the new default.
const FACE_EDGE = 1600;
const FACE_QUALITY = 80;

/**
 * Resolve the path to vips.exe (the libvips CLI with native HEIF support).
 * VIPSTHUMBNAIL_PATH points at the bundled vipsthumbnail.exe; vips.exe lives
 * in the same bin directory. Calling by full path lets Windows resolve the
 * bundled DLLs (libheif, libde265, glib, …) from that directory automatically.
 * Falls back to "vips" on PATH if the env var is unset.
 */
const VIPS_EXE = process.env.VIPSTHUMBNAIL_PATH
  ? join(dirname(process.env.VIPSTHUMBNAIL_PATH), 'vips.exe')
  : 'vips';

// Cache binary availability across requests: null = unknown, true/false = resolved.
let vipsAvailable: boolean | null = null;

/**
 * Try native HEIC → JPEG thumbnail via `vips thumbnail` (libvips CLI).
 * Returns the JPEG buffer, or null if vips is unavailable / this file failed
 * (caller then falls back to the WASM path).
 */
async function tryVips(buffer: Buffer): Promise<Buffer | null> {
  if (vipsAvailable === false) return null;

  // If an explicit path was given but vips.exe isn't there, disable permanently.
  if (process.env.VIPSTHUMBNAIL_PATH && !existsSync(VIPS_EXE)) {
    if (vipsAvailable === null) {
      console.info(`[Convert] VIPSTHUMBNAIL_PATH set but ${VIPS_EXE} not present — using WASM HEIC decoder.`);
    }
    vipsAvailable = false;
    return null;
  }

  const id = randomUUID();
  const inPath = join(tmpdir(), `piccurate-${id}.heic`);
  const outPath = join(tmpdir(), `piccurate-${id}.jpg`);

  try {
    await writeFile(inPath, buffer);

    // vips thumbnail <in> <out> <width> --height H --crop centre
    // width+height+crop=centre → resize to fill and centre-crop to exactly 512×512.
    // EXIF orientation is auto-applied (no-rotate defaults to false).
    await execFileAsync(
      VIPS_EXE,
      [
        'thumbnail',
        inPath,
        `${outPath}[Q=${THUMBNAIL_QUALITY},strip]`,
        String(THUMBNAIL_SIZE),
        '--height', String(THUMBNAIL_SIZE),
        '--crop', 'centre',
      ],
      { timeout: 25000 }
    );

    const out = await readFile(outPath);
    if (vipsAvailable === null) {
      vipsAvailable = true;
      console.log('[Convert] vips thumbnail detected — using native HEIF decode');
    }
    return out;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      // No vips binary available (typical on Linux/Vercel) — disable
      // permanently and fall back to the WASM decoder. Expected, not an error.
      if (vipsAvailable === null) {
        console.info('[Convert] No native vips binary on this runtime — using WASM HEIC decoder.');
      }
      vipsAvailable = false;
      return null;
    }
    if (vipsAvailable === null) {
      // First attempt failed before any success — this libvips can't decode the
      // input (e.g. prebuilt Windows libvips lacks the HEVC decoder). Disable the
      // native path for this process so we don't spawn a doomed process per file.
      const stderr = (e as unknown as { stderr?: string }).stderr;
      console.warn('[Convert] native vips decode unavailable (likely no HEVC decoder) — using WASM fallback for this session.', stderr ? `Detail: ${String(stderr).trim().split('\n').pop()}` : e.message);
      vipsAvailable = false;
      return null;
    }
    // Native worked before but failed on this specific file — fall back for it only.
    console.warn('[Convert] vips thumbnail failed for this file, falling back:', e.message);
    return null;
  } finally {
    unlink(inPath).catch(() => {});
    unlink(outPath).catch(() => {});
  }
}

/**
 * POST /api/convert?thumbnail=1
 *
 * Converts a HEIC/HEIF image to JPEG.
 * With ?thumbnail=1 (default), returns a 512×512 JPEG thumbnail (~30 KB).
 *
 * Strategy (fastest first):
 *  1. vipsthumbnail.exe — native libvips+libheif. ~0.1–0.3s/file. Requires the
 *     libvips Windows binary; enable via VIPSTHUMBNAIL_PATH.
 *  2. sharp native HEIF decode — only if libvips was built with libheif
 *     (npm prebuilt is NOT, so this usually throws).
 *  3. heic-decode (libheif WASM) → raw RGBA → sharp native resize/encode.
 *     ~3s/file. Always available, no external binary needed.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = await checkRateLimit(`convert:${ip}`, CONVERT_RL_LIMIT, CONVERT_RL_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    // Fast-path reject on the declared size (best-effort; header is spoofable).
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await request.arrayBuffer());

    // Authoritative size check on the ACTUAL bytes — a client can omit/spoof
    // Content-Length, so the header check above is not sufficient on its own.
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    // Three modes: ?face=1 (large, uncropped — for local face detection),
    // ?thumbnail=0 (full resolution), and the default 512 square thumbnail.
    const wantFace = request.nextUrl.searchParams.get('face') === '1';
    const makeThumbnail = !wantFace && request.nextUrl.searchParams.get('thumbnail') !== '0';
    const t0 = Date.now();

    let jpegBuffer: Buffer | null = null;

    // Path 1: native vipsthumbnail (only used for the thumbnail hot path)
    if (makeThumbnail) {
      jpegBuffer = await tryVips(buffer);
      if (jpegBuffer) {
        console.log(`[Convert] vips-native: ${(jpegBuffer.length / 1024).toFixed(0)} KB in ${Date.now() - t0}ms`);
      }
    }

    if (!jpegBuffer) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sharp = require('sharp');

      // Path 2: native sharp HEIF decode (usually unavailable on npm builds)
      try {
        // .rotate() with no args auto-applies the EXIF orientation tag, then
        // strips it — so the output pixels are upright. Without this, sharp
        // leaves rotated photos sideways/upside-down.
        let pipeline = sharp(buffer, { failOn: 'none' }).rotate();
        if (makeThumbnail) {
          pipeline = pipeline.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'centre' });
        } else if (wantFace) {
          // 'inside' + withoutEnlargement: cap the long edge, never crop, never
          // upscale a photo that is already smaller.
          pipeline = pipeline.resize(FACE_EDGE, FACE_EDGE, { fit: 'inside', withoutEnlargement: true });
        }
        const buf: Buffer = await pipeline
          .jpeg({ quality: makeThumbnail ? THUMBNAIL_QUALITY : wantFace ? FACE_QUALITY : 85 })
          .toBuffer();
        console.log(`[Convert] sharp-native: ${(buf.length / 1024).toFixed(0)} KB in ${Date.now() - t0}ms`);
        jpegBuffer = buf;
      } catch {
        // Path 3: libheif WASM decode → raw RGBA → sharp native resize/encode
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const decode = require('heic-decode');
        const { width, height, data } = await decode({ buffer });

        const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        let pipeline = sharp(raw, { raw: { width, height, channels: 4 } });
        if (makeThumbnail) {
          pipeline = pipeline.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'centre' });
        } else if (wantFace) {
          pipeline = pipeline.resize(FACE_EDGE, FACE_EDGE, { fit: 'inside', withoutEnlargement: true });
        }
        const buf: Buffer = await pipeline
          .jpeg({ quality: makeThumbnail ? THUMBNAIL_QUALITY : wantFace ? FACE_QUALITY : 85 })
          .toBuffer();
        console.log(`[Convert] libheif+sharp: ${width}×${height} → ${(buf.length / 1024).toFixed(0)} KB in ${Date.now() - t0}ms`);
        jpegBuffer = buf;
      }
    }

    return new NextResponse(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': jpegBuffer.length.toString(),
      },
    });
  } catch (err) {
    // The detail belongs in the server log, not in the response. Handing the
    // raw message back put module paths and an "npm install --include=optional
    // sharp" instruction into a photo tile the moment sharp failed to load. The
    // client treats every failure here the same way — it re-decodes in the
    // browser — so it has no use for the text either.
    console.error('[Convert] HEIC conversion failed:', err);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}
