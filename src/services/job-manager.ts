import type { Job, Tier, JobStatus } from '@/types/job';
import type { CriteriaConfig } from '@/types/criteria';
import { DEFAULT_CRITERIA } from '@/types/criteria';
import { getPlan } from '@/types/pricing';

/**
 * Job Manager — handles job lifecycle operations.
 * All database calls use the Supabase admin client (bypasses RLS)
 * because API routes validate auth separately.
 */

interface SupabaseClient {
  from: (table: string) => any;
}

export class JobManager {
  constructor(private db: SupabaseClient) {}

  /** Create a new curation job */
  async createJob(userId: string, tier: Tier): Promise<Job> {
    const plan = getPlan(tier);

    // Check free tier eligibility (free 250 photos = once per user, not per
    // login). See product-pipeline.md §4.2.1.
    // TODO(free-tier-blocker): the per-account flag below is the primary guard
    // but only as strong as account uniqueness — enforce verified email, and
    // consider an additional IP-based rate signal as a weak fallback against
    // multi-account abuse (easily bypassed via VPN/CGNAT, so treat as a hint,
    // not a hard gate). Strategic counter-measure: invest in paid-tier
    // "Mehrnutzen" worth paying for, not just in tighter blocking.
    if (tier === 'free') {
      const { data: profile } = await this.db
        .from('profiles')
        .select('free_tier_used')
        .eq('id', userId)
        .single();

      if (profile?.free_tier_used) {
        throw new Error('FREE_TIER_ALREADY_USED');
      }
    }

    // A paid tier the tester unlocked during the beta instead of buying it
    // (see /api/beta/unlock). It runs as a normal job of that tier, but is
    // settled by the grant rather than by a payment — and is flagged, because
    // the analysis route has to let it past the per-IP daily photo cap that
    // would otherwise refuse the allowance we just promised.
    let betaGrant = false;
    if (tier !== 'free') {
      const { data: profile } = await this.db
        .from('profiles')
        .select('beta_grant_tier')
        .eq('id', userId)
        .single();
      betaGrant = profile?.beta_grant_tier === tier;
    }

    const { data, error } = await this.db
      .from('jobs')
      .insert({
        user_id: userId,
        tier,
        photo_limit: plan.photoLimit,
        payment_status: tier === 'free' || betaGrant ? 'free' : 'pending',
        beta_grant: betaGrant,
        criteria: DEFAULT_CRITERIA,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create job: ${error.message}`);
    return this.mapJob(data);
  }

  /** Get a job by ID */
  async getJob(jobId: string): Promise<Job | null> {
    const { data, error } = await this.db
      .from('jobs')
      .select()
      .eq('id', jobId)
      .single();

    if (error || !data) return null;
    return this.mapJob(data);
  }

  /** List jobs for a user */
  async listJobs(userId: string): Promise<Job[]> {
    const { data, error } = await this.db
      .from('jobs')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(`Failed to list jobs: ${error.message}`);
    return (data || []).map(this.mapJob);
  }

  /** Update job status */
  async updateStatus(jobId: string, status: JobStatus): Promise<void> {
    const { error } = await this.db
      .from('jobs')
      .update({ status })
      .eq('id', jobId);

    if (error) throw new Error(`Failed to update status: ${error.message}`);
  }

  /** Update job criteria */
  async updateCriteria(jobId: string, criteria: CriteriaConfig): Promise<void> {
    const { error } = await this.db
      .from('jobs')
      .update({ criteria })
      .eq('id', jobId);

    if (error) throw new Error(`Failed to update criteria: ${error.message}`);
  }

  /** Increment photo count */
  async incrementPhotoCount(jobId: string, count: number): Promise<void> {
    // Use RPC or raw SQL for atomic increment
    const { data: job } = await this.db
      .from('jobs')
      .select('photo_count, photo_limit')
      .eq('id', jobId)
      .single();

    if (!job) throw new Error('Job not found');
    if (job.photo_count + count > job.photo_limit) {
      throw new Error('PHOTO_LIMIT_EXCEEDED');
    }

    const { error } = await this.db
      .from('jobs')
      .update({ photo_count: job.photo_count + count })
      .eq('id', jobId);

    if (error) throw new Error(`Failed to increment photo count: ${error.message}`);
  }

  /** Mark free tier as used for a user */
  async markFreeTierUsed(userId: string): Promise<void> {
    const { error } = await this.db
      .from('profiles')
      .update({ free_tier_used: true })
      .eq('id', userId);

    if (error) throw new Error(`Failed to mark free tier: ${error.message}`);
  }

  /** Update payment status after Stripe webhook */
  async updatePaymentStatus(
    jobId: string,
    paymentStatus: 'paid' | 'free',
    stripeSessionId?: string
  ): Promise<void> {
    const update: Record<string, unknown> = { payment_status: paymentStatus };
    if (stripeSessionId) update.stripe_session_id = stripeSessionId;

    const { error } = await this.db
      .from('jobs')
      .update(update)
      .eq('id', jobId);

    if (error) throw new Error(`Failed to update payment: ${error.message}`);
  }

  /** Map database row to Job type */
  private mapJob(row: Record<string, unknown>): Job {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      status: row.status as Job['status'],
      tier: row.tier as Tier,
      photoCount: row.photo_count as number,
      photoLimit: row.photo_limit as number,
      stripeSessionId: row.stripe_session_id as string | null,
      paymentStatus: row.payment_status as Job['paymentStatus'],
      criteria: row.criteria as CriteriaConfig,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      expiresAt: row.expires_at as string,
    };
  }
}
