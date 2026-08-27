import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
import { emailConfigured, sendOrderConfirmation, paidTierLabel } from '@/lib/email';
import type Stripe from 'stripe';

/**
 * POST /api/payments/webhook
 * Handles Stripe webhook events.
 * Must be excluded from CSRF protection.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // `completed` fires as soon as checkout finishes. For card payments that
      // means the money is there; for delayed methods (SEPA direct debit, some
      // bank redirects) it does not, and the confirmation arrives later as
      // `async_payment_succeeded`. Handling only the first would leave a paying
      // customer with an unpaid job; handling only the second would break
      // cards. Both, and the write is idempotent, so a redelivery is harmless.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const jobId = session.metadata?.jobId;
        const userId = session.metadata?.userId;

        if (!jobId || !userId) {
          console.error('Webhook: Missing jobId or userId in metadata');
          break;
        }

        // A delayed method that has not cleared yet: acknowledge the event so
        // Stripe stops retrying, but do not unlock the job.
        if (
          event.type === 'checkout.session.completed' &&
          session.payment_status === 'unpaid'
        ) {
          console.log(`[Webhook] Job ${jobId}: payment pending, waiting for async confirmation`);
          break;
        }

        console.log(`[Webhook] Payment completed for job ${jobId}, user ${userId}`);

        const db = createAdminClient();
        const jobManager = new JobManager(db);
        await jobManager.updatePaymentStatus(jobId, 'paid', session.id);

        console.log(`[Webhook] Job ${jobId} marked as paid`);

        // § 312f BGB confirmation of the contract in text form. Failing to send
        // it must be loud, not a silent warning in a log nobody reads: it is
        // the record the customer keeps, and it carries the withdrawal notice.
        // The payment itself stays valid either way; we do not fail the
        // webhook, because Stripe would retry and we would re-confirm a job
        // that is already unlocked.
        try {
          const { data: job } = await db
            .from('jobs')
            .select('tier, photo_limit')
            .eq('id', jobId)
            .maybeSingle();
          const { data: profile } = await db
            .from('profiles')
            .select('email, locale')
            .eq('id', userId)
            .maybeSingle();

          const to = session.customer_details?.email || profile?.email || '';
          const locale = profile?.locale === 'de' ? 'de' : 'en';

          if (!to) {
            console.error(`[Webhook] Job ${jobId}: no address for the order confirmation`);
          } else if (!emailConfigured()) {
            console.error(`[Webhook] Job ${jobId}: RESEND_API_KEY unset, confirmation NOT sent`);
          } else {
            const ok = await sendOrderConfirmation({
              to,
              tierLabel: paidTierLabel(String(job?.tier ?? session.metadata?.tier ?? '')),
              photoLimit: Number(job?.photo_limit ?? 0),
              amountGrossCents: session.amount_total ?? 0,
              currency: session.currency ?? 'eur',
              orderRef: session.id,
              placedAt: new Date(),
              locale,
            });
            if (!ok) {
              console.error(`[Webhook] Job ${jobId}: order confirmation FAILED to send to ${to}`);
            } else if (jobId) {
              // Discharges the obligation for this job, so the download gate's
              // later trigger cannot mail a second confirmation — one that
              // would have to state a price it does not know.
              await db
                .from('jobs')
                .update({ confirmation_sent_at: new Date().toISOString() })
                .eq('id', jobId);
            }
          }
        } catch (mailErr) {
          console.error(`[Webhook] Job ${jobId}: order confirmation error:`, mailErr);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.warn(`[Webhook] Payment failed: ${intent.id}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
