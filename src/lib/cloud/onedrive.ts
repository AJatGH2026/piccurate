'use client';

// OneDrive export via Microsoft Graph. Client-side PKCE OAuth (public SPA client,
// no secret) + direct upload from the browser. Requires an Azure app registration
// (SPA platform) — set NEXT_PUBLIC_ONEDRIVE_CLIENT_ID and register the redirect URI
// printed by redirectUri() below. See docs/product-pipeline.md §7.3.

import type { CloudFile, CloudProgress, CloudProvider } from './interface';
import { SELECTION_FOLDER } from './interface';
import { createPkce, popupOAuth, randomState } from './pkce';

const CLIENT_ID = process.env.NEXT_PUBLIC_ONEDRIVE_CLIENT_ID || '';
const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPE = 'Files.ReadWrite offline_access';
const SIMPLE_MAX = 4 * 1024 * 1024; // Graph simple-PUT limit; larger needs an upload session
const CHUNK = 5 * 1024 * 1024;

// Single registered redirect URI (locale-fixed; the callback is a machine-only page).
function redirectUri(): string {
  return `${window.location.origin}/en/cloud/callback`;
}

const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const itemPath = (name: string) => `${GRAPH}/me/drive/root:/${encPath(SELECTION_FOLDER)}/${encodeURIComponent(name)}:`;

async function getToken(popup?: Window | null): Promise<string> {
  const { verifier, challenge } = await createPkce();
  const state = randomState();
  const authUrl =
    `${AUTH}/authorize?` +
    new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri(),
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      response_mode: 'query',
      state,
    }).toString();

  const code = await popupOAuth(authUrl, state, popup);

  const res = await fetch(`${AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      scope: SCOPE,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const json = await res.json();
  return json.access_token as string;
}

async function uploadSmall(token: string, name: string, blob: Blob): Promise<void> {
  // Path upload auto-creates the parent folder.
  const res = await fetch(`${itemPath(name)}/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed for ${name} (${res.status})`);
}

async function uploadLarge(token: string, name: string, blob: Blob): Promise<void> {
  const sess = await fetch(`${itemPath(name)}/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
  });
  if (!sess.ok) throw new Error(`Upload session failed for ${name} (${sess.status})`);
  const { uploadUrl } = await sess.json();
  const total = blob.size;
  for (let start = 0; start < total; start += CHUNK) {
    const end = Math.min(start + CHUNK, total);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${start}-${end - 1}/${total}` },
      body: blob.slice(start, end),
    });
    // 202 = chunk accepted; 200/201 = final chunk completed the file
    if (![200, 201, 202].includes(res.status)) throw new Error(`Chunk upload failed for ${name} (${res.status})`);
  }
}

export const oneDrive: CloudProvider = {
  id: 'onedrive',
  label: 'OneDrive',
  isConfigured() {
    return !!CLIENT_ID;
  },
  async uploadSelection(files: CloudFile[], onProgress?: (p: CloudProgress) => void, popup?: Window | null) {
    const token = await getToken(popup);
    let done = 0;
    for (const f of files) {
      onProgress?.({ done, total: files.length, current: f.name });
      if (f.blob.size > SIMPLE_MAX) await uploadLarge(token, f.name, f.blob);
      else await uploadSmall(token, f.name, f.blob);
      done++;
      onProgress?.({ done, total: files.length, current: f.name });
    }
    return { folderName: SELECTION_FOLDER, uploaded: done };
  },
};
