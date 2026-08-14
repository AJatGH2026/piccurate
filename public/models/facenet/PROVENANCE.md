# FaceNet InceptionResnetV1 (VGGFace2) — provenance

- **Source code/wrapper**: `timesler/facenet-pytorch`, MIT License (Timothy Esler),
  verified at `LICENSE.md` in that repo, 2026-08-12.
- **Pretrained weights**: `20180402-114759-vggface2.pt`, fetched from the
  project's own GitHub release `v2.2.9` — trained on **VGGFace2**, not
  MS-Celeb-1M (confirmed against docs/legal/personensuche-umsetzungsplan.md
  § 5.1 stage-2 rule).
- **This file**: `facenet_vggface2.onnx`, exported from the PyTorch checkpoint
  via `scripts/spike/export-facenet/export.py` on 2026-08-12 (opset 17).
  Equivalence-checked against the PyTorch reference on 5 random inputs:
  max abs diff 1e-7, cosine similarity ≈ 1.0.
- **Input**: 160×160 RGB face crop → 512-d embedding.
## Size variants (measured 13.08.2026, Phase 2 step 1)

The float32 export is **89.6 MB** — far above the ~50 MB the plan's § 6.4
assumed for *all* models combined, and too large to ship into a browser tab.
Two smaller variants were produced by `scripts/spike/export-facenet/quantize.py`
and measured on the full 309-photo test set, on **identical detections and
crops**, so any difference is attributable to quantization alone:

| Variante | Größe | Hauptzahl Include (§ 5.2) | Exclude | Kosinus zu fp32 |
|---|---|---|---|---|
| `facenet_vggface2.onnx` (fp32) | 89,6 MB | 0,709 | 0,653 | — |
| **`facenet_vggface2_fp16.onnx`** | **44,9 MB** | **0,709** | **0,653** | Median 0,999999 |
| `facenet_vggface2_int8.onnx` | 22,8 MB | 0,674 | 0,642 | Median 0,985 |

- **fp16 ist verlustfrei.** Identische Zahlen bis auf die dritte Nachkommastelle,
  identische Arbeitspunkte, größte Einzelabweichung im Vektor 1,8·10⁻³.
  **Halbe Größe, kein messbarer Preis.**
- **int8 kostet 3,5 Punkte Recall** (0,709 → 0,674) für weitere 22 MB Ersparnis.
  Beide Precision-Tore bleiben erfüllt; der Verlust trifft ausschließlich die
  Kennzahl, die ohnehin schon 9 Punkte unter Ziel liegt.

**Empfehlung: fp16 ausliefern.** int8 nur, falls die Ladezeit über die
Genauigkeit gestellt wird.
