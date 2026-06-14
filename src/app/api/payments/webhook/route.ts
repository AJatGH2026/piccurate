import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/server';
import { JobManager } from '@/services/job-manager';
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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const jobId = session.metadata?.jobId;
        const userId = session.metadata?.userId;

        if (!jobId || !userId) {
          console.error('Webhook: Missing jobId or userId in metadata');
          break;
        }

        console.log(`[Webhook] Payment completed for job ${jobId}, user ${userId}`);

        const db = createAdminClient();
        const jobManager = new JobManager(db);
        await jobManager.updatePaymentStatus(jobId, 'paid', session.id);

        console.log(`[Webhook] Job ${jobId} marked as paid`);
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
