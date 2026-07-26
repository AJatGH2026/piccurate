'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Internal evaluation tool — German UI, no i18n. Not part of the product.
// Taxonomy v2: 13 primary motifs + multi-select secondary (place/time-of-day).

interface ManifestEntry {
  id: string;
  filename: string;
  thumb: string;
  dateTaken: string | null;
}

type Keep = 'yes' | 'no' | 'maybe';

interface Label {
  primary: string | null;
  secondary: string[];
  keep: Keep | null;
  sharp: boolean; // true = scharf
  faces: boolean;
  animals: boolean;
  seriesWithPrev: boolean;
  reviewed: boolean; // touched/confirmed in the v2 pass
}

const PRIMARY: { key: string; value: string; label: string }[] = [
  { key: '1', value: 'people', label: 'People' },
  { key: '2', value: 'animal', label: 'Animal' },
  { key: '3', value: 'flora', label: 'Flora' },
  { key: '4', value: 'food', label: 'Food' },
  { key: '5', value: 'building', label: 'Building' },
  { key: '6', value: 'interior', label: 'Interior' },
  { key: '7', value: 'signage', label: 'Signage' },
  { key: '8', value: 'landscape', label: 'Landscape' },
  { key: '9', value: 'beach', label: 'Beach' },
  { key: '0', value: 'mountain', label: 'Mountain' },
  { key: 'q', value: 'city', label: 'City' },
  { key: 'w', value: 'street', label: 'Street' },
  { key: 'e', value: 'other', label: 'Other' },
];

const SECONDARY: { key: string; value: string; label: string }[] = [
  { key: 'i', value: 'indoor', label: 'Indoor' },
  { key: 'h', value: 'beach', label: 'Beach' },
  { key: 'm', value: 'mountain', label: 'Mountain' },
  { key: 'c', value: 'city', label: 'City' },
  { key: 'g', value: 'goldenhour', label: 'Golden hour' },
  { key: 'n', value: 'night', label: 'Night' },
];

const KEEP_LABEL: Record<Keep, string> = { yes: 'Ja', no: 'Nein', maybe: 'Vielleicht' };
const KEEP_COLOR: Record<Keep, string> = { yes: 'bg-green-600', no: 'bg-red-600', maybe: 'bg-amber-500' };

// Old (v1) → new (v2) primary migration
const MIGRATE: Record<string, string> = { nature: 'landscape', sunset: 'landscape', architecture: 'building' };

function newLabel(): Label {
  return { primary: null, secondary: [], keep: null, sharp: true, faces: false, animals: false, seriesWithPrev: false, reviewed: true };
}

/** Convert a stored entry (v1 with sceneType, or v2) into a v2 Label. */
function migrate(raw: Record<string, unknown> | undefined): Label {
  if (!raw) return { ...newLabel(), reviewed: false };
  if (raw.primary !== undefined) {
    // already v2
    return {
      primary: (raw.primary as string | null) ?? null,
      secondary: Array.isArray(raw.secondary) ? (raw.secondary as string[]) : [],
      keep: (raw.keep as Keep | null) ?? null,
      sharp: (raw.sharp as boolean) ?? true,
      faces: (raw.faces as boolean) ?? false,
      animals: (raw.animals as boolean) ?? false,
      seriesWithPrev: (raw.seriesWithPrev as boolean) ?? false,
      reviewed: (raw.reviewed as boolean) ?? false,
    };
  }
  // v1 → v2 (pre-fill, mark unreviewed so it shows up for the v2 pass)
  const old = raw.sceneType as string | undefined;
  return {
    primary: old ? MIGRATE[old] ?? old : null,
    secondary: [],
    keep: (raw.keep as Keep | null) ?? null,
    sharp: (raw.sharp as boolean) ?? true,
    faces: (raw.faces as boolean) ?? false,
    animals: (raw.animals as boolean) ?? false,
    seriesWithPrev: (raw.seriesWithPrev as boolean) ?? false,
    reviewed: false,
  };
}

function isDone(l: Label | undefined): boolean {
  return !!l && l.reviewed && l.primary != null && l.keep != null;
}

export default function LabelPage() {
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [labels, setLabels] = useState<Record<string, Label>>({});
  const [current, setCurrent] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const currentRef = useRef(0);
  const manifestRef = useRef<ManifestEntry[]>([]);
  currentRef.current = current;
  manifestRef.current = manifest;

  useEffect(() => {
    (async () => {
      try {
        const m = await fetch('/eval/manifest.json', { cache: 'no-store' });
        if (!m.ok) throw new Error('Manifest noch nicht vorhanden.');
        const entries: ManifestEntry[] = await m.json();
        setManifest(entries);
        const l = await fetch('/api/eval/labels', { cache: 'no-store' });
        if (l.ok) {
          const raw = await l.json();
          const migrated: Record<string, Label> = {};
          for (const id of Object.keys(raw)) migrated[id] = migrate(raw[id]);
          setLabels(migrated);
        }
        const saved = Number(localStorage.getItem('eval-label-index') || '0');
        if (!Number.isNaN(saved) && saved < entries.length) setCurrent(saved);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Ladefehler');
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('eval-label-index', String(current));
  }, [current]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (Object.keys(labels).length === 0) return;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/eval/labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labels }),
        });
        setSaveState('saved');
      } catch {
        setSaveState('idle');
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [labels]);

  const mutate = useCallback((fn: (l: Label) => Label) => {
    const entry = manifestRef.current[currentRef.current];
    if (!entry) return;
    setLabels((prev) => {
      const existing = prev[entry.id] ?? newLabel();
      return { ...prev, [entry.id]: { ...fn(existing), reviewed: true } };
    });
  }, []);

  const go = useCallback((delta: number) => {
    // advancing forward confirms the current entry as reviewed
    if (delta > 0) {
      const entry = manifestRef.current[currentRef.current];
      if (entry) {
        setLabels((prev) => {
          const ex = prev[entry.id];
          if (ex && ex.primary && ex.keep && !ex.reviewed) return { ...prev, [entry.id]: { ...ex, reviewed: true } };
          return prev;
        });
      }
    }
    setCurrent((c) => Math.min(manifestRef.current.length - 1, Math.max(0, c + delta)));
  }, []);

  const jumpToFirstUnlabeled = useCallback(() => {
    setLabels((prev) => {
      const idx = manifestRef.current.findIndex((e) => !isDone(prev[e.id]));
      if (idx >= 0) setCurrent(idx);
      return prev;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const prim = PRIMARY.find((s) => s.key === k);
      if (prim) return void mutate((l) => ({ ...l, primary: prim.value }));
      const sec = SECONDARY.find((s) => s.key === k);
      if (sec) return void mutate((l) => ({ ...l, secondary: l.secondary.includes(sec.value) ? l.secondary.filter((x) => x !== sec.value) : [...l.secondary, sec.value] }));
      if (e.key === ' ') {
        e.preventDefault();
        return void mutate((l) => ({ ...l, keep: l.keep === 'yes' ? 'no' : l.keep === 'no' ? 'maybe' : 'yes' }));
      }
      if (k === 'b') return void mutate((l) => ({ ...l, sharp: !l.sharp }));
      if (k === 'f') return void mutate((l) => ({ ...l, faces: !l.faces }));
      if (k === 't') return void mutate((l) => ({ ...l, animals: !l.animals }));
      if (k === 's') return void mutate((l) => ({ ...l, seriesWithPrev: !l.seriesWithPrev }));
      if (e.key === 'ArrowRight' || e.key === 'Enter') return void go(1);
      if (e.key === 'ArrowLeft') return void go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mutate, go]);

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-200">
        <p className="text-zinc-400">{loadError}</p>
        <button onClick={() => location.reload()} className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          Neu laden
        </button>
      </div>
    );
  }
  if (manifest.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">Lade Manifest…</div>;
  }

  const entry = manifest[current];
  const label = labels[entry.id] ?? newLabel();
  const doneCount = manifest.filter((e) => isDone(labels[e.id])).length;
  const prevEntry = current > 0 ? manifest[current - 1] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 h-12 flex items-center justify-between text-sm">
        <span className="font-semibold text-indigo-400">AuswahlBuddy · Eval-Labeling v2</span>
        <div className="flex items-center gap-4 text-zinc-400">
          <span>Bild {current + 1} / {manifest.length}</span>
          <span className="text-green-400">{doneCount} bestätigt</span>
          <span className="text-xs">{saveState === 'saving' ? '… speichern' : saveState === 'saved' ? '✓ gespeichert' : ''}</span>
        </div>
      </header>
      <div className="h-1 bg-zinc-800">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${(doneCount / manifest.length) * 100}%` }} />
      </div>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto w-full">
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.thumb} alt={entry.filename} className={`max-h-[68vh] rounded-lg object-contain ${isDone(label) ? 'ring-2 ring-green-500/40' : 'ring-2 ring-amber-500/30'}`} />
            {label.seriesWithPrev && prevEntry && (
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full hidden xl:block opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={prevEntry.thumb} alt="vorheriges" className="h-24 rounded border border-amber-500" />
                <p className="text-[10px] text-amber-400 text-center mt-1">Serie ↗</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            {entry.filename}{entry.dateTaken ? ` · ${new Date(entry.dateTaken).toLocaleString('de-DE')}` : ' · kein Datum'}
            {!label.reviewed && <span className="ml-2 text-amber-400">· noch nicht bestätigt</span>}
          </p>
          <div className="mt-3 flex gap-3">
            <button onClick={() => go(-1)} className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm hover:bg-zinc-800">← Zurück</button>
            <button onClick={() => go(1)} className="rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-semibold hover:bg-indigo-700">Weiter →</button>
            <button onClick={jumpToFirstUnlabeled} className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm hover:bg-zinc-800">⤳ Nächstes offenes</button>
          </div>
        </div>

        <div className="lg:w-80 flex-shrink-0 space-y-4">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Hauptmotiv</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {PRIMARY.map((s) => (
                <button key={s.value} onClick={() => mutate((l) => ({ ...l, primary: s.value }))}
                  className={`flex items-center justify-between rounded px-2.5 py-1.5 text-sm border transition-colors ${label.primary === s.value ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-zinc-700 hover:bg-zinc-800'}`}>
                  <span>{s.label}</span><kbd className="text-[10px] text-zinc-400">{s.key}</kbd>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Ort / Zeit (mehrfach)</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {SECONDARY.map((s) => {
                const on = label.secondary.includes(s.value);
                return (
                  <button key={s.value} onClick={() => mutate((l) => ({ ...l, secondary: on ? l.secondary.filter((x) => x !== s.value) : [...l.secondary, s.value] }))}
                    className={`flex items-center justify-between rounded px-2 py-1.5 text-xs border transition-colors ${on ? 'bg-teal-600 border-teal-500 text-white' : 'border-zinc-700 hover:bg-zinc-800'}`}>
                    <span>{s.label}</span><kbd className="text-[10px] text-zinc-400">{s.key}</kbd>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Behalten? <kbd className="text-[10px]">Leertaste</kbd></h3>
            <div className="flex gap-1.5">
              {(['yes', 'no', 'maybe'] as Keep[]).map((kk) => (
                <button key={kk} onClick={() => mutate((l) => ({ ...l, keep: kk }))}
                  className={`flex-1 rounded px-2 py-2 text-sm border transition-colors ${label.keep === kk ? `${KEEP_COLOR[kk]} border-transparent text-white` : 'border-zinc-700 hover:bg-zinc-800'}`}>
                  {KEEP_LABEL[kk]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Toggle label="Scharf" hotkey="b" active={label.sharp} onText="scharf" offText="unscharf" onClick={() => mutate((l) => ({ ...l, sharp: !l.sharp }))} />
            <Toggle label="Gesichter" hotkey="f" active={label.faces} onClick={() => mutate((l) => ({ ...l, faces: !l.faces }))} />
            <Toggle label="Tiere" hotkey="t" active={label.animals} onClick={() => mutate((l) => ({ ...l, animals: !l.animals }))} />
            <Toggle label="Serie (wie Vorbild)" hotkey="s" active={label.seriesWithPrev} onClick={() => mutate((l) => ({ ...l, seriesWithPrev: !l.seriesWithPrev }))} />
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed pt-2 border-t border-zinc-800">
            <b>1–0/q/w/e</b> Motiv · <b>i h m c g n</b> Ort/Zeit · <b>Leertaste</b> Behalten · <b>b/f/t/s</b> Schärfe/Gesichter/Tiere/Serie · <b>← →</b> Navigation. „Weiter" bestätigt das Bild.
          </p>
        </div>
      </main>
    </div>
  );
}

function Toggle({ label, hotkey, active, onText = 'ja', offText = 'nein', onClick }: { label: string; hotkey: string; active: boolean; onText?: string; offText?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between rounded px-3 py-2 text-sm border transition-colors ${active ? 'bg-zinc-700 border-zinc-600' : 'border-zinc-800 hover:bg-zinc-900'}`}>
      <span className="flex items-center gap-2">{label} <kbd className="text-[10px] text-zinc-400">{hotkey}</kbd></span>
      <span className={active ? 'text-green-400' : 'text-zinc-500'}>{active ? onText : offText}</span>
    </button>
  );
}
