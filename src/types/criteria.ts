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
