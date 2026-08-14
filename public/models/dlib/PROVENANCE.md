# dlib ResNet-34 face recognition weights — provenance

- **Original weights**: `dlib_face_recognition_resnet_model_v1.dat`, by Davis King
  (`davisking/dlib-models`), released into the **public domain** (verified at
  `davisking/dlib-models/README.md`, 2026-08-12).
- **Training data**: ~3M faces / 7,485 identities, derived from FaceScrub +
  VGG Face + web-scraped images, manually cleaned. **Not** MS-Celeb-1M —
  confirmed against docs/legal/personensuche-umsetzungsplan.md § 5.1 stage-2 rule.
- **This copy**: TensorFlow.js conversion of the above weights, distributed by
  `vladmandic/face-api` (wrapper code MIT, Vladimir Mandic) as
  `face_recognition_model.bin` + `face_recognition_model-weights_manifest.json`,
  fetched from `github.com/vladmandic/face-api/tree/master/model` on 2026-08-12.
- **Input**: 150×150 RGB face crop → 128-d embedding.
