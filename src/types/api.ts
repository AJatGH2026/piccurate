import type { Tier } from './job';
import type { CriteriaConfig } from './criteria';

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** POST /api/jobs - Create a new job */
export interface CreateJobRequest {
  tier: Tier;
  photoCount: number;
}

export interface CreateJobResponse {
  jobId: string;
  tier: Tier;
  photoLimit: number;
  requiresPayment: boolean;
}

/** POST /api/jobs/[jobId]/upload - Upload thumbnails */
export interface UploadPhotoMeta {
  filename: string;
  dateTaken: string | null;
  latitude: number | null;
  longitude: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  orientation: number | null;
  originalWidth: number | null;
  originalHeight: number | null;
  fileSizeBytes: number;
}

/** POST /api/jobs/[jobId]/analyze - Trigger analysis */
export interface AnalyzeRequest {
  // No body needed - uses job's current photos
}

export interface AnalyzeResponse {
  analyzedCount: number;
  status: string;
}

/** POST /api/jobs/[jobId]/select - Run selection */
export interface SelectRequest {
  criteria: CriteriaConfig;
}

export interface SelectResponse {
  selectedCount: number;
  totalCount: number;
  groups: number; // number of day/location groups
}

/** POST /api/payments/create-checkout */
export interface CreateCheckoutRequest {
  jobId: string;
  tier: Tier;
  locale: string;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}
