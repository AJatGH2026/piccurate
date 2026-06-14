import type { CriteriaConfig } from './criteria';

export type JobStatus =
  | 'created'
  | 'uploading'
  | 'analyzing'
  | 'selecting'
  | 'ready'
  | 'expired'
  | 'failed';

export type PaymentStatus = 'pending' | 'paid' | 'free';

export type Tier = 'free' | 'small' | 'medium' | 'large';

export interface Job {
  id: string;
  userId: string;
  status: JobStatus;
  tier: Tier;
  photoCount: number;
  photoLimit: number;
  stripeSessionId: string | null;
  paymentStatus: PaymentStatus;
  criteria: CriteriaConfig;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

/** Summary returned when listing jobs */
export interface JobSummary {
  id: string;
  status: JobStatus;
  tier: Tier;
  photoCount: number;
  selectedCount: number;
  createdAt: string;
}
