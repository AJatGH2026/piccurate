/** Reason why a photo was selected */
export type ReasonCategory =
  | 'best_expression'
  | 'unique_location'
  | 'best_landscape'
  | 'best_architecture'
  | 'best_animal'
  | 'best_food'
  | 'highest_resolution'
  | 'golden_hour'
  | 'group_photo'
  | 'unique_content'
  | 'top_aesthetic'
  | 'sharpest';

export interface ReasonTag {
  category: ReasonCategory;
  label: string; // Human-readable, e.g. "Best group shot - 3 faces, all eyes open"
}

/** Result of the selection engine for a single photo */
export interface SelectionResult {
  photoId: string;
  selected: boolean;
  score: number;
  reasonTag: ReasonTag | null;
}

/** Grouped selection results by day/location */
export interface SelectionGroup {
  date: string; // YYYY-MM-DD
  location: string | null; // Place name derived by the AI from GPS, or null
  latitude: number | null;
  longitude: number | null;
  totalPhotos: number;
  selectedPhotos: number;
  results: SelectionResult[];
}

/** Overall selection summary */
export interface SelectionSummary {
  totalPhotos: number;
  selectedPhotos: number;
  selectionPercentage: number;
  groups: SelectionGroup[];
  sceneTypeBreakdown: Record<string, number>;
}
