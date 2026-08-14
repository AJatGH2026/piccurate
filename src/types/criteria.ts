/** Individual criterion configuration */
export interface Criterion {
  enabled: boolean;
  weight: number; // 0.0 to 1.0
}

/** A user-defined criterion: a free-text term (e.g. "car", "Fuß") + strength. */
export interface CustomCriterion {
  term: string;
  weight: number; // 0.1–1.0 (slider 1–10); 1.0 = exclusive filter
}

/**
 * A named person identified by a reference photo. Session-only — the reference
 * blob lives in the photo store, never in localStorage (biometric data /
 * DSGVO Art. 9 must not be persisted client-side without an explicit consent
 * gate we don't have yet). Selection reads name + weight; the blob is only
 * needed when the analysis request is built.
 */
export interface Person {
  id: string;
  name: string;
  weight: number; // 0.1–1.0 (slider 1–10); 1.0 = exclusive filter
  /**
   * "include": bias toward / only photos containing this person (slider drives strength).
   * "exclude": hard filter — photos containing this person are removed from the pool,
   *            regardless of any other criterion (analog to negative custom terms).
   *            The slider is irrelevant in this mode.
   */
  mode: 'include' | 'exclude';
  thumbnailUrl: string; // blob URL for preview (revoked on removal)
  blob: Blob; // JPEG reference photo sent to the LLM at analysis time
  /**
   * Face embedding of this person, computed on the device when the reference
   * photo was picked (local person search).
   *
   * Computed at pick time rather than at match time for two reasons: the crop
   * comes from the ORIGINAL file rather than the 512 px square preview (§ 9.5 —
   * the square is centre-cropped and loses resolution the match depends on), and
   * the user finds out immediately when a reference photo contains no usable
   * face, instead of silently getting no matches later.
   *
   * `null` means no face was found in the reference photo, or the models were
   * unavailable. Never transmitted; dropped with the session.
   */
  embedding: number[] | null;
}

/** Max reference persons the user may define — enforced by the UI. */
export const MAX_PERSONS = 4;

/** Full criteria configuration for a curation job */
export interface CriteriaConfig {
  preferFaces: Criterion;
  preferAnimals: Criterion;
  preferLandscapes: Criterion;
  preferArchitecture: Criterion;
  preferFood: Criterion;
  preferSharpness: Criterion;
  /** User-defined terms the AI tags during analysis; behave like motif criteria. */
  customCriteria: CustomCriterion[];
  /** Percentage of photos to select (1-30, default 8) */
  selectionPercentage: number;
  /** How aggressively to collapse near-duplicate series (1-10, default 8) */
  dedupSensitivity: number;
}

/**
 * Default criteria configuration.
 * All preferences default OFF: the base ranking is the model's holistic
 * album_score (validated best predictor of what people keep). Toggling a
 * preference on biases the selection toward that category — pure opt-in
 * personalization, so the default stays at peak quality.
 */
export const DEFAULT_CRITERIA: CriteriaConfig = {
  preferFaces: { enabled: false, weight: 0.5 },
  preferAnimals: { enabled: false, weight: 0.5 },
  preferLandscapes: { enabled: false, weight: 0.5 },
  preferArchitecture: { enabled: false, weight: 0.5 },
  preferFood: { enabled: false, weight: 0.5 },
  preferSharpness: { enabled: false, weight: 0.5 },
  customCriteria: [],
  selectionPercentage: 8,
  dedupSensitivity: 8,
};
