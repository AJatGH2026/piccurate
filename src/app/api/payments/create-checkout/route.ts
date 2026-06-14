import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/client';
import { TIER_CONFIGS } from '@/lib/stripe/prices';
import type { ApiResponse, CreateCheckoutRequest, CreateCheckoutResponse } from '@/types/api';

/**
 * POST /api/payments/create-checkout
 * Creates a Stripe Checkout session for a paid tier.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateCheckoutRequest = await request.json();
    const { jobId, tier, locale } = body;

    // Validate tier
    const tierConfig = TIER_CONFIGS[tier];
    if (!tierConfig || tier === 'free' || !tierConfig.stripePriceId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid tier for checkout' },
        { status: 400 }
      );
    }

    // Verify job exists and belongs to user
    const { data: job } = await supabase
      .from('jobs')
      .select('id, user_id, payment_status')
      .eq('id', jobId)
      .single();

    if (!job || job.user_id !== user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.payment_status === 'paid') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Job is already paid' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: tierConfig.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        jobId,
        userId: user.id,
        tier,
      },
      success_url: `${appUrl}/${locale}/app/upload?session_id={CHECKOUT_SESSION_ID}&job=${jobId}`,
      cancel_url: `${appUrl}/${locale}/app/pricing?cancelled=true&job=${jobId}`,
      locale: locale === 'de' ? 'de' : 'en',
    });

    const response: CreateCheckoutResponse = {
      checkoutUrl: session.url!,
      sessionId: session.id,
    };

    return NextResponse.json<ApiResponse<CreateCheckoutResponse>>({
      success: true,
      data: response,
    });
  } catch (err) {
    console.error('POST /api/payments/create-checkout error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: err instanceof Error ? err.message : 'Checkout creation failed' },
      { status: 500 }
    );
  }
}
