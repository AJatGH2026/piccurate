import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export const maxDuration = 30;

const EVAL_DIR = join(process.cwd(), '.eval');
const REFERENCE = join(EVAL_DIR, 'reference.json');

/**
 * Dev/eval-only endpoint — gate behind ADMIN_TOKEN so it can't be read or
 * overwritten anonymously. Returns 404 (hides existence) when the token is
 * unset or wrong. Accept via `x-admin-token` header or `?key=` query param.
 */
function adminOk(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get('x-admin-token') || req.nextUrl.searchParams.get('key') || '';
  if (!provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/eval/labels
 * Returns the saved reference labels (the human-labeled ground truth), or {} if none yet.
 */
export async function GET(request: NextRequest) {
  if (!adminOk(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const raw = await readFile(REFERENCE, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({});
  }
}

/**
 * POST /api/eval/labels
 * Persists the full labels map to .eval/reference.json.
 * Body: { labels: Record<photoId, Label> }
 */
export async function POST(request: NextRequest) {
  if (!adminOk(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const labels = body?.labels;
    if (!labels || typeof labels !== 'object') {
      return NextResponse.json({ error: 'Missing labels object' }, { status: 400 });
    }
    await mkdir(EVAL_DIR, { recursive: true });
    await writeFile(REFERENCE, JSON.stringify(labels, null, 2), 'utf-8');
    return NextResponse.json({ ok: true, count: Object.keys(labels).length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 }
    );
  }
}
