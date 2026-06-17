'use client';

// Dropbox integration — export (upload selection) and import (browse + download).
// Client-side PKCE OAuth (public app, no secret) + direct API calls (Dropbox
// endpoints support CORS, so no server proxy and originals stay in the browser).
//
// Requires a Dropbox app and NEXT_PUBLIC_DROPBOX_APP_KEY, with redirect URI
// <APP_URL>/en/cloud/callback. Export needs files.content.write; import needs
// files.metadata.read + files.content.read and "Full Dropbox" access to browse
// the user's library. See docs/product-pipeline.md section 7.3 / 7.5.

import type { CloudFile, CloudProgress, CloudProvider } from './interface';
import { SELECTION_FOLDER } from './interface';
import { createPkce, popupOAuth, randomState } from './pkce';

const APP_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || '';
const AUTHORIZE = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const UPLOAD = 'https://content.dropboxapi.com/2/files/upload';
const DOWNLOAD = 'https://content.dropboxapi.com/2/files/download';
const LIST = 'https://api.dropboxapi.com/2/files/list_folder';
const LIST_CONTINUE = 'https://api.dropboxapi.com/2/files/list_folder/continue';

export const DROPBOX_WRITE_SCOPE = 'files.content.write';
export const DROPBOX_READ_SCOPE = 'files.metadata.read files.content.read';

export function dropboxConfigured(): boolean {
  return !!APP_KEY;
}

function redirectUri(): string {
  return `${window.location.origin}/en/cloud/callback`;
}

// Current PicCurate UI locale, taken from the first path segment (/en/... or
// /de/...). Passed to Dropbox so its consent screen matches the site language.
function currentLocale(): string {
  const seg = window.location.pathname.split('/')[1];
  return seg === 'de' ? 'de' : 'en';
}

// The Dropbox-API-Arg header must be ASCII; escape any char above '~' (0x7e) as \uXXXX.
function apiArg(obj: unknown): string {
  const json = JSON.stringify(obj);
  let out = '';
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    out += code > 0x7e ? '\\u' + code.toString(16).padStart(4, '0') : json[i];
  }
  return out;
}

/** OAuth (popup, PKCE) for the given space-separated scope string. Returns an access token. */
export async function dropboxAuth(scope: string): Promise<string> {
  const { verifier, challenge } = await createPkce();
  const state = randomState();
  const authUrl =
    `${AUTHORIZE}?` +
    new URLSearchParams({
      client_id: APP_KEY,
      response_type: 'code',
      redirect_uri: redirectUri(),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope,
      state,
      locale: currentLocale(),
      // Force an explicit Dropbox sign-in every time. Without this, Dropbox
      // silently reuses the browser's existing session + prior app approval,
      // so a logged-in user is never asked which account to connect. Forcing
      // re-auth guarantees each user links their OWN account (and makes the
      // per-user nature visible). force_reapprove also re-shows the consent.
      force_reauthentication: 'true',
      force_reapprove: 'true',
    }).toString();

  const code = await popupOAuth(authUrl, state);

  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: APP_KEY,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const json = await res.json();
  return json.access_token as string;
}

// ── Import (browse + download) ────────────────────────────
export interface DropboxEntry {
  type: 'folder' | 'file';
  name: string;
  path: string;
}

/** List a Dropbox folder (path "" = root). Follows pagination. */
export async function dropboxList(token: string, path: string): Promise<DropboxEntry[]> {
  const out: DropboxEntry[] = [];
  const collect = (entries: Record<string, unknown>[]) => {
    for (const e of entries) {
      const tag = e['.tag'];
      if (tag === 'folder' || tag === 'file') {
        out.push({ type: tag, name: String(e.name), path: String(e.path_lower) });
      }
    }
  };

  let res = await fetch(LIST, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive: false, limit: 2000 }),
  });
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  let data = await res.json();
  collect(data.entries || []);
  while (data.has_more) {
    res = await fetch(LIST_CONTINUE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: data.cursor }),
    });
    if (!res.ok) break;
    data = await res.json();
    collect(data.entries || []);
  }
  return out;
}

/**
 * Download a Dropbox file's bytes by path. Times out after 60 s and retries
 * once on transient network errors ("Failed to fetch" / TypeError), which can
 * happen with several parallel connections.
 */
export async function dropboxDownload(token: string, path: string): Promise<Blob> {
  try {
    return await dropboxDownloadOnce(token, path);
  } catch (e) {
    // Retry once on a transient network error; surface real errors directly.
    const transient = e instanceof TypeError;
    if (!transient) throw e;
    await new Promise((r) => setTimeout(r, 500));
    return await dropboxDownloadOnce(token, path);
  }
}

async function dropboxDownloadOnce(token: string, path: string): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await dropboxDownloadInner(token, path, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function dropboxDownloadInner(token: string, path: string, signal: AbortSignal): Promise<Blob> {
  const res = await fetch(DOWNLOAD, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': apiArg({ path }) },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.blob();
}

// ── Export (upload selection) ─────────────────────────────
export const dropbox: CloudProvider = {
  id: 'dropbox',
  label: 'Dropbox',
  isConfigured() {
    return dropboxConfigured();
  },
  async uploadSelection(files: CloudFile[], onProgress?: (p: CloudProgress) => void) {
    const token = await dropboxAuth(DROPBOX_WRITE_SCOPE);
    let done = 0;
    for (const f of files) {
      onProgress?.({ done, total: files.length, current: f.name });
      const arg = apiArg({
        path: `/${SELECTION_FOLDER}/${f.name}`,
        mode: 'add',
        autorename: true,
        mute: true,
      });
      const res = await fetch(UPLOAD, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': arg,
          'Content-Type': 'application/octet-stream',
        },
        body: f.blob,
      });
      if (!res.ok) throw new Error(`Upload failed for ${f.name} (${res.status})`);
      done++;
      onProgress?.({ done, total: files.length, current: f.name });
    }
    return { folderName: SELECTION_FOLDER, uploaded: done };
  },
};
