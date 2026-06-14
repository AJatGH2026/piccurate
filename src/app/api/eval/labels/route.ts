import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const maxDuration = 30;

const EVAL_DIR = join(process.cwd(), '.eval');
const REFERENCE = join(EVAL_DIR, 'reference.json');

/**
 * GET /api/eval/labels
 * Returns the saved reference labels (the human-labeled ground truth), or {} if none yet.
 */
export async function GET() {
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
