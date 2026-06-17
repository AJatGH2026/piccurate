'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import {
  DROPBOX_READ_SCOPE,
  dropboxAuth,
  dropboxDownload,
  dropboxList,
  type DropboxEntry,
} from '@/lib/cloud/dropbox';

const IMAGE_RE = /\.(jpe?g|png|heic|heif|webp|gif)$/i;

interface Crumb {
  name: string;
  path: string;
}

export function DropboxImport({
  onImport,
  onClose,
}: {
  onImport: (files: File[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations('upload');
  const tc = useTranslations('common');
  const [token, setToken] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ name: 'Dropbox', path: '' }]);
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({}); // path → name
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  // Anchor for shift-click range selection (index into imageEntries).
  const [lastIndex, setLastIndex] = useState<number | null>(null);

  const load = useCallback(async (tok: string, path: string) => {
    setLoading(true);
    setError(null);
    setLastIndex(null); // new folder → reset the range anchor
    try {
      const list = await dropboxList(tok, path);
      list.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Authenticate once, then list root
  useEffect(() => {
    (async () => {
      try {
        const tok = await dropboxAuth(DROPBOX_READ_SCOPE);
        setToken(tok);
        await load(tok, '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Authentication failed');
        setLoading(false);
      }
    })();
  }, [load]);

  const openFolder = (entry: DropboxEntry) => {
    if (!token) return;
    setCrumbs((c) => [...c, { name: entry.name, path: entry.path }]);
    load(token, entry.path);
  };

  const goToCrumb = (idx: number) => {
    if (!token) return;
    const next = crumbs.slice(0, idx + 1);
    setCrumbs(next);
    load(token, next[next.length - 1].path);
  };

  // Image files shown in the current folder (defined before the click handler,
  // which reads it for shift-range selection).
  const imageEntries = entries.filter((e) => e.type === 'file' && IMAGE_RE.test(e.name));

  // Click a file row: plain click toggles it; shift-click selects the whole
  // range from the previous click (the anchor) to here, like a file explorer.
  const handleFileClick = (idx: number, shiftKey: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (shiftKey && lastIndex !== null) {
        const [a, b] = lastIndex < idx ? [lastIndex, idx] : [idx, lastIndex];
        for (let i = a; i <= b; i++) next[imageEntries[i].path] = imageEntries[i].name;
      } else {
        const e = imageEntries[idx];
        if (next[e.path]) delete next[e.path];
        else next[e.path] = e.name;
      }
      return next;
    });
    setLastIndex(idx);
  };
  const allSelected = imageEntries.length > 0 && imageEntries.every((e) => selected[e.path]);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = { ...prev };
      if (allSelected) {
        // Deselect every image in this folder.
        for (const e of imageEntries) delete next[e.path];
      } else {
        // Select every image in this folder (keeps selections from other folders).
        for (const e of imageEntries) next[e.path] = e.name;
      }
      return next;
    });
  };

  const doImport = async () => {
    if (!token) return;
    const paths = Object.keys(selected);
    if (paths.length === 0) return;
    const total = paths.length;
    const slots: (File | null)[] = new Array(total).fill(null);
    const failures: { name: string; reason: string }[] = [];
    let done = 0;
    // Sequential downloads — empirically the parallel variant triggered
    // immediate "Failed to fetch" on every request (likely simultaneous CORS
    // preflights racing against Dropbox's preflight handling). Sequential
    // was slow but reliable, so we keep it and rely on the timeout/retry
    // for robustness.
    const CONCURRENCY = 1;
    setImporting(t('dbxImporting', { done: 0, total }));
    setError(null);

    // Worker-pool with per-file error tolerance — one failure won't abort
    // the whole import; failed files are collected and reported afterwards.
    let next = 0;
    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= total) return;
        const p = paths[i];
        const name = selected[p];
        try {
          const blob = await dropboxDownload(token, p);
          slots[i] = new File([blob], name, { type: blob.type || 'application/octet-stream' });
        } catch (e) {
          const reason =
            e instanceof Error
              ? e.name === 'AbortError'
                ? 'timeout'
                : e.message
              : 'unknown';
          failures.push({ name, reason });
        }
        done++;
        setImporting(t('dbxImporting', { done, total }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

    const files = slots.filter((f): f is File => f !== null);
    if (files.length === 0) {
      setError(t('dbxAllFailed', { reason: failures[0]?.reason || 'network' }));
      setImporting(null);
      return;
    }
    if (failures.length > 0) {
      // Still pass the successful ones up; show a non-blocking warning here.
      setError(t('dbxSomeFailed', { count: failures.length, total }));
    }
    onImport(files);
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + breadcrumb */}
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{t('dropboxTitle')}</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
            {crumbs.map((c, i) => (
              <span key={c.path || 'root'} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                <button onClick={() => goToCrumb(i)} className="hover:text-indigo-600">{c.name}</button>
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[200px]">
          {loading ? (
            <p className="text-center text-sm text-zinc-500 py-8">{tc('loading')}</p>
          ) : error ? (
            <p className="text-center text-sm text-red-600 py-8 px-4">{error}</p>
          ) : entries.filter((e) => e.type === 'folder' || IMAGE_RE.test(e.name)).length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-8">{t('dbxEmpty')}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {imageEntries.length > 0 && (
                <li>
                  <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded font-medium">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-indigo-600" />
                    {allSelected ? t('dbxDeselectAll') : t('dbxSelectAll', { count: imageEntries.length })}
                    <span className="ml-auto font-normal text-xs text-zinc-400">{t('dbxShiftHint')}</span>
                  </label>
                </li>
              )}
              {entries
                .filter((e) => e.type === 'folder' || IMAGE_RE.test(e.name))
                .map((e) =>
                  e.type === 'folder' ? (
                    <li key={e.path}>
                      <button onClick={() => openFolder(e)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded">
                        <span>📁</span>
                        <span className="text-zinc-800 dark:text-zinc-200">{e.name}</span>
                      </button>
                    </li>
                  ) : (
                    <li key={e.path}>
                      <div
                        onClick={(ev) => handleFileClick(imageEntries.findIndex((x) => x.path === e.path), ev.shiftKey)}
                        className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded"
                      >
                        <input type="checkbox" readOnly checked={!!selected[e.path]} className="accent-indigo-600 pointer-events-none" />
                        <span>🖼️</span>
                        <span className="text-zinc-700 dark:text-zinc-300 truncate">{e.name}</span>
                      </div>
                    </li>
                  )
                )}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">{importing ?? `${selectedCount}`}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-full border border-zinc-300 dark:border-zinc-600 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {tc('close')}
            </button>
            <button
              onClick={doImport}
              disabled={selectedCount === 0 || !!importing}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold ${
                selectedCount === 0 || importing
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {t('dbxImport', { count: selectedCount })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
