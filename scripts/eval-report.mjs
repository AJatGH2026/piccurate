// Compares the three model result sets against the v2 human reference and writes
// public/eval/report.html (http://localhost:3000/eval/report.html).
//   node scripts/eval-report.mjs

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const EVAL_DIR = join(process.cwd(), '.eval');
const REPORT = join(process.cwd(), 'public', 'eval', 'report.html');
const SCENES = ['people', 'animal', 'flora', 'food', 'building', 'interior', 'signage', 'landscape', 'beach', 'mountain', 'city', 'street', 'other'];
const SECONDARY = ['indoor', 'beach', 'mountain', 'city', 'goldenhour', 'night'];
const MODELS = [{ key: 'haiku', label: 'Haiku 4.5' }, { key: 'sonnet', label: 'Sonnet 4.6' }, { key: 'opus', label: 'Opus 4.8' }];

function pr(tp, fp, fn) {
  const p = tp + fp === 0 ? null : tp / (tp + fp);
  const r = tp + fn === 0 ? null : tp / (tp + fn);
  return { p, r, f1: p && r ? (2 * p * r) / (p + r) : null };
}
const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
const refPrimary = (r) => r.primary || r.sceneType;
const load = async (p, fb) => { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } };

async function main() {
  const ref = await load(join(EVAL_DIR, 'reference.json'), {});
  const ids = Object.keys(ref).filter((id) => refPrimary(ref[id]) && ref[id].keep);
  if (!ids.length) { console.error('No labeled photos.'); process.exit(1); }
  console.log(`Evaluating against ${ids.length} labeled photos.`);

  const data = {};
  for (const m of MODELS) data[m.key] = await load(join(EVAL_DIR, `results-${m.key}.json`), null);

  const per = [];
  for (const m of MODELS) {
    const d = data[m.key];
    if (!d) { per.push({ ...m, missing: true }); continue; }
    let sceneOk = 0, n = 0;
    let shTP = 0, shFP = 0, shFN = 0, fTP = 0, fFP = 0, fFN = 0, aTP = 0, aFP = 0, aFN = 0;
    let secTP = 0, secFP = 0, secFN = 0;
    for (const id of ids) {
      const r = ref[id], mo = d.results[id];
      if (!mo) continue;
      n++;
      if (mo.sceneType === refPrimary(r)) sceneOk++;
      const refBlur = r.sharp === false, moBlur = (mo.sharpnessScore ?? 5) < 5;
      if (refBlur && moBlur) shTP++; else if (!refBlur && moBlur) shFP++; else if (refBlur && !moBlur) shFN++;
      const rf = !!r.faces, mf = (mo.faceCount ?? 0) > 0;
      if (rf && mf) fTP++; else if (!rf && mf) fFP++; else if (rf && !mf) fFN++;
      const ra = !!r.animals, ma = !!mo.hasAnimal;
      if (ra && ma) aTP++; else if (!ra && ma) aFP++; else if (ra && !ma) aFN++;
      const refSec = new Set(r.secondary || []), moSec = new Set(mo.secondary || []);
      for (const t of SECONDARY) { const rr = refSec.has(t), mm = moSec.has(t); if (rr && mm) secTP++; else if (!rr && mm) secFP++; else if (rr && !mm) secFN++; }
    }
    per.push({ ...m, n, sceneAcc: sceneOk / n, sharp: pr(shTP, shFP, shFN), faces: pr(fTP, fFP, fFN), animals: pr(aTP, aFP, aFN), secondary: pr(secTP, secFP, secFN), cost: d.usage?.costUsd, seconds: d.usage ? Math.round(d.usage.ms / 1000) : null });
  }

  const sceneRecall = {};
  for (const s of SCENES) { sceneRecall[s] = {}; for (const m of MODELS) { const d = data[m.key]; if (!d) continue; let c = 0, t = 0; for (const id of ids) { if (refPrimary(ref[id]) !== s) continue; t++; if (d.results[id]?.sceneType === s) c++; } sceneRecall[s][m.key] = { c, t }; } }

  await writeFile(REPORT, html(ids.length, per, sceneRecall), 'utf-8');
  console.log(`\nReport → public/eval/report.html`);
  for (const m of per) m.missing ? console.log(`${m.label}: (keine Ergebnisse)`) : console.log(`${m.label}: Primär ${pct(m.sceneAcc)} · Sekundär-F1 ${pct(m.secondary.f1)} · Schärfe-F1 ${pct(m.sharp.f1)} · Gesichter-F1 ${pct(m.faces.f1)} · Tiere-F1 ${pct(m.animals.f1)} · $${m.cost}`);
}

function html(n, per, sceneRecall) {
  const head = per.map((m) => `<th>${m.label}</th>`).join('');
  const row = (l, v) => `<tr><td>${l}</td>${v.map((x) => `<td>${x}</td>`).join('')}</tr>`;
  const summary = `<table><thead><tr><th>Metrik</th>${head}</tr></thead><tbody>
    ${row('Primär-Genauigkeit', per.map((m) => m.missing ? '—' : `<b>${pct(m.sceneAcc)}</b>`))}
    ${row('Sekundär (Ort/Zeit) F1', per.map((m) => m.missing ? '—' : pct(m.secondary.f1)))}
    ${row('Schärfe (unscharf) F1', per.map((m) => m.missing ? '—' : pct(m.sharp.f1)))}
    ${row('Gesichter F1', per.map((m) => m.missing ? '—' : pct(m.faces.f1)))}
    ${row('Tiere F1', per.map((m) => m.missing ? '—' : pct(m.animals.f1)))}
    ${row('Kosten', per.map((m) => m.missing ? '—' : `$${m.cost}`))}
    ${row('Dauer', per.map((m) => m.missing ? '—' : `${m.seconds}s`))}
  </tbody></table>`;
  const sceneRows = SCENES.map((s) => {
    const cells = per.map((m) => { if (m.missing) return '<td>—</td>'; const r = sceneRecall[s][m.key]; if (!r || !r.t) return '<td class=muted>—</td>'; const rate = r.c / r.t; const cls = rate >= 0.8 ? 'good' : rate >= 0.5 ? 'ok' : 'bad'; return `<td class=${cls}>${pct(rate)} <span class=muted>(${r.c}/${r.t})</span></td>`; });
    return `<tr><td>${s}</td>${cells.join('')}</tr>`;
  }).join('');
  return `<!doctype html><html lang=de><head><meta charset=utf-8><title>Modell-Vergleich v2</title><style>
   body{font:14px/1.5 system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 20px;color:#18181b}
   h1{font-size:22px}h2{font-size:16px;margin-top:32px;color:#3730a3}
   table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #e4e4e7;padding:7px 10px;text-align:left}
   th{background:#f4f4f5}td:first-child,th:first-child{font-weight:500}
   .good{background:#dcfce7}.ok{background:#fef9c3}.bad{background:#fee2e2}.muted{color:#a1a1aa;font-weight:400}.note{color:#52525b;font-size:13px}
  </style></head><body>
  <h1>PicCurate · Modell-Vergleich (Taxonomie v2)</h1>
  <p class=note>Bewertet gegen <b>${n}</b> manuell gelabelte Fotos. F1 = Balance aus Precision &amp; Recall.</p>
  <h2>Übersicht</h2>${summary}
  <h2>Primär-Trefferquote je Kategorie</h2>
  <p class=note>grün ≥80%, gelb ≥50%, rot &lt;50%.</p>
  <table><thead><tr><th>Kategorie</th>${head}</tr></thead><tbody>${sceneRows}</tbody></table>
  <p class=note style=margin-top:24px>Erzeugt ${new Date().toLocaleString('de-DE')}.</p></body></html>`;
}

main().catch((e) => { console.error(e); process.exit(1); });
