// Durable storage for beta feedback in Supabase (table `public.feedback`,
// migration 003). Storage is the primary path; the notification mail in
// src/lib/email.ts is best-effort on top. Every function degrades to a no-op
// (null/false) when Supabase isn't configured, so the caller can fall back to
// the Upstash list in src/lib/beta.ts and nothing is lost either way.
//
// Service-role only: the table has RLS on with no policies, so it is invisible
// to the browser. Never import this from client code.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface FeedbackRow {
  id: string;
  created_at: string;
  message: string;
  locale: string | null;
  path: string | null;
  emailed: boolean;
}

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** True when feedback can be persisted (Supabase URL + service-role key set). */
export function feedbackDbConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Persist one feedback message. Returns the new row id, or null when Supabase
 * isn't configured or the insert failed — the caller then falls back to Upstash.
 */
export async function saveFeedbackToDb(
  message: string,
  meta: { locale?: string; path?: string }
): Promise<string | null> {
  const db = getClient();
  if (!db) return null;
  const text = String(message || '').trim().slice(0, 5000);
  if (!text) return null;
  try {
    const { data, error } = await db
      .from('feedback')
      .insert({
        message: text,
        locale: meta.locale || null,
        path: meta.path || null,
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[feedback] insert failed:', error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.warn('[feedback] insert error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Best-effort: record that the notification mail was accepted. Never throws —
 * a failure here only costs the dashboard a flag, not the feedback itself.
 */
export async function markFeedbackEmailed(id: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  try {
    await db.from('feedback').update({ emailed: true }).eq('id', id);
  } catch {
    /* ignore */
  }
}

/**
 * Recent feedback plus the total row count for the admin dashboard. Returns
 * null when Supabase isn't configured, so the caller can show the Upstash data
 * instead.
 */
export async function readFeedbackFromDb(
  limit = 20
): Promise<{ entries: FeedbackRow[]; count: number } | null> {
  const db = getClient();
  if (!db) return null;
  try {
    const { data, error, count } = await db
      .from('feedback')
      .select('id, created_at, message, locale, path, emailed', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('[feedback] read failed:', error.message);
      return null;
    }
    return { entries: (data as FeedbackRow[]) ?? [], count: count ?? 0 };
  } catch (err) {
    console.warn('[feedback] read error:', err instanceof Error ? err.message : err);
    return null;
  }
}
