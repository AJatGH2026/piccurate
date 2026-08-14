/** EXIF metadata extracted client-side from the original photo */
export interface EXIFData {
  dateTaken: string | null; // ISO 8601
  latitude: number | null;
  longitude: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  orientation: number | null;
  originalWidth: number | null;
  originalHeight: number | null;
  fileSizeBytes: number;
}

/** AI analysis results returned by Claude Vision */
export interface AIAnalysis {
  aestheticScore: number; // 1-10
  albumScore: number; // 1-10 — holistic keep-worthiness (primary ranking signal)
  sharpnessScore: number; // 1-10
  faceAnalysis: {
    count: number;
    eyesOpen: boolean;
    facingCamera: boolean;
    expression: 'friendly' | 'neutral' | 'negative' | 'none';
  };
  animalAnalysis: {
    present: boolean;
    clarityScore: number; // 1-10
    proximityScore: number; // 1-10
  };
  sceneType:
    | 'people'
    | 'animal'
    | 'flora'
    | 'food'
    | 'building'
    | 'interior'
    | 'signage'
    | 'landscape'
    | 'beach'
    | 'mountain'
    | 'city'
    | 'street'
    | 'other';
  secondary: string[]; // place/time context tags: indoor, beach, mountain, city, goldenhour, night
  contentTags: string[]; // 3-5 descriptive tags
  customMatches: string[]; // user-defined terms the model found in this photo (lowercased)
  persons: string[]; // names of reference persons the model recognised in this photo (lowercased)
  place: string; // place name derived from the photo's GPS ("City, Country"); '' when no GPS
}

/** A photo at various stages of processing */
export interface Photo {
  id: string;
  jobId: string;
  filename: string;
  thumbnailKey: string; // Storage path for 512x512 thumbnail

  // EXIF metadata
  exif: EXIFData;

  // AI analysis (null until analyzed)
  analysis: AIAnalysis | null;

  // Perceptual hash for similarity detection (null until computed)
  phash: string | null;

  // Selection state
  selected: boolean;
  reasonTag: string | null;
  selectionScore: number | null;

  createdAt: string;
}

/** Client-side photo being processed (before upload) */
export interface ClientPhoto {
  id: string; // temporary client ID
  file: File;
  filename: string;
  exif: EXIFData | null;
  thumbnailBlob: Blob | null;
  thumbnailUrl: string | null; // Object URL for preview
  phash: string | null; // 16-hex perceptual hash for near-duplicate / series detection
  embedding: number[] | null; // CLIP image embedding (computed in background) for cross-camera dedup
  /**
   * One unit-normalised face embedding per face detected in this photo, computed
   * entirely on the device (local person search).
   *
   * `null` means the face pass did not run — either the user never activated the
   * person search, or the models failed to load. It does NOT mean "no faces";
   * that is an empty array.
   *
   * Deliberately the embeddings and not a match result: the "streng ↔ großzügig"
   * threshold is a slider the user moves after the fact, and re-matching from
   * stored vectors is instant, whereas re-running the model over 1 500 photos is
   * not. Cost is ~2 KB per face.
   *
   * Session-only, never persisted, never transmitted (§ 3 rules 3 and 8 of
   * docs/legal/personensuche-umsetzungsplan.md).
   */
  faceEmbeddings: number[][] | null;
  status: 'pending' | 'extracting' | 'generating' | 'ready' | 'uploading' | 'uploaded' | 'error';
  error: string | null;
}
