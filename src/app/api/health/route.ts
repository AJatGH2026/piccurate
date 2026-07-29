import { NextResponse } from 'next/server';

export async function GET() {
  // TEMP diagnostic: report only PRESENCE + length of key env vars so we can
  // tell whether the running Production function actually sees them — never
  // the values themselves. Remove after debugging the admin-token setup.
  const adminToken = process.env.ADMIN_TOKEN ?? '';
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

  return NextResponse.json({
    status: 'ok',
    service: 'piccurate',
    timestamp: new Date().toISOString(),
    env: {
      adminTokenSet: adminToken.length > 0,
      adminTokenLen: adminToken.length,
      upstashConfigured: upstashUrl.length > 0 && upstashToken.length > 0,
      vercelEnv: process.env.VERCEL_ENV ?? '(local)',
    },
  });
}
