// The sample demo ("Mit Beispielfotos ansehen", /[locale]/demo/beispiel).
//
// A frozen fixture of 101 photos — the analysis ran ONCE, offline, with the
// same prompt, thumbnail, pHash and CLIP model a real upload uses — so the demo
// shows the real selection logic without any upload, account, job or model
// call. Nothing here touches usePhotoStore, /api/jobs or /api/analyze-demo: the
// demo concludes no contract and fires no `analysis_started`.
//
// Regenerate the fixture (don't hand-edit it) after a change to the analysis
// prompt or taxonomy; the tooling lives in the private sibling repo.

import type { ProcessedPhoto } from '@/hooks/usePhotoStore';

export interface SampleFixturePhoto {
  id: string;
  filename: string;
  src: string;
  /** true = AI-generated sample photo, false = a real photo (labelled in the UI). */
  generated: boolean;
  phash: string | null;
  embedding: number[] | null;
  dateTaken: string | null;
  cameraModel: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  aestheticScore: number;
  albumScore: number;
  sharpnessScore: number;
  sceneType: string;
  secondary: string[];
  faceCount: number;
  facesEyesOpen: boolean;
  facesFacingCamera: boolean;
  facesExpression: string;
  hasAnimal: boolean;
  animalClarity: number;
  animalProximity: number;
  contentTags: string[];
}

export interface SampleFixture {
  version: number;
  builtAt: string;
  model: string;
  photos: SampleFixturePhoto[];
}

export const SAMPLE_FIXTURE_URL = '/demo-set/fixture.json';

/** Turn the fixture into the store's photo shape, so the real selection code runs on it unchanged. */
export function toProcessedPhotos(fixture: SampleFixture): ProcessedPhoto[] {
  return fixture.photos.map((p) => ({
    id: p.id,
    filename: p.filename,
    originalFile: null,
    thumbnailUrl: p.src,
    thumbnailBlob: null,
    phash: p.phash,
    embedding: p.embedding,
    faceEmbeddings: null,
    dateTaken: p.dateTaken,
    latitude: null,
    longitude: null,
    cameraModel: p.cameraModel,
    originalWidth: p.originalWidth,
    originalHeight: p.originalHeight,
    aestheticScore: p.aestheticScore,
    albumScore: p.albumScore,
    sharpnessScore: p.sharpnessScore,
    sceneType: p.sceneType,
    secondary: p.secondary,
    faceCount: p.faceCount,
    facesEyesOpen: p.facesEyesOpen,
    facesFacingCamera: p.facesFacingCamera,
    facesExpression: p.facesExpression,
    hasAnimal: p.hasAnimal,
    animalClarity: p.animalClarity,
    animalProximity: p.animalProximity,
    contentTags: p.contentTags,
    customMatches: [],
    persons: [],
    place: '',
    selected: false,
    saved: false,
    reasonTag: null,
    selectionScore: 0,
    analyzed: true,
  }));
}
