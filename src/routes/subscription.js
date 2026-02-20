import { Router } from 'express';
import { createCheckoutSchema, portalSessionSchema } from '../utils/schemas.js';
import { createCheckoutSession, createPortalSession, SUBSCRIPTION_PLANS } from '../utils/stripe.js';
import { getUserSubscription, upsertSubscription, hasActiveSubscription, getEffectivePlanId, getUsageStats, canGenerateResume } from '../utils/supabase.js';
import { getStripeSubscription, getCheckoutSession, findSubscriptionByCustomerEmail } from '../utils/stripe.js';

const normalizeStripeId = (x) => (x == null ? null : typeof x === 'string' ? x : x?.id ?? null);

// When DB has no subscription row, try to recover from Stripe by email (e.g. webhook/from-session missed).
// Used automatically in GET /status and GET /usage so the frontend doesn't have to call POST /recover.
async function tryRecoverSubscriptionFromStripe(userId, userEmail) {
  if (!userEmail) return { recovered: false };
  const { subscription } = await getUserSubscription(userId);
  if (subscription?.stripe_subscription_id) return { recovered: false };
  const { subscription: stripeSub, customerId, planId, error: findErr } = await findSubscriptionByCustomerEmail(userEmail);
  if (findErr || !stripeSub || !customerId) return { recovered: false };
  const subscriptionData = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSub.id,
    status: stripeSub.status,
    plan_id: planId || 'basic',
    current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
  };
  const { error: upsertError } = await upsertSubscription(subscriptionData);
  if (upsertError) return { recovered: false };
  return { recovered: true };
}

export const subscriptionRouter = Router();

// Get available subscription plans (no cache so clients always get latest shape e.g. priceLabel)
subscriptionRouter.get('/plans', (_req, res) => {
  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    priceLabel: plan.priceLabel ?? null,
    features: plan.features,
    limits: plan.limits,
  }));

  res.setHeader('Cache-Control', 'no-store');
  return res.json({ plans });
});

// Get current user's subscription status
subscriptionRouter.get('/status', async (req, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    let { subscription, error } = await getUserSubscription(userId);

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to fetch subscription status' });
    }

    // If no row in DB, try to recover from Stripe by email (user paid but webhook/from-session missed)
    if (!subscription?.stripe_subscription_id && userEmail) {
      const { recovered } = await tryRecoverSubscriptionFromStripe(userId, userEmail);
      if (recovered) {
        const next = await getUserSubscription(userId);
        subscription = next.subscription || subscription;
      }
    }

    // Refresh from Stripe when we have a subscription row so Supabase stays in sync (handles stale or delayed webhook)
    let subscriptionForResponse = subscription;
    if (subscription?.stripe_subscription_id) {
      const { subscription: stripeSub, error: stripeErr } = await getStripeSubscription(subscription.stripe_subscription_id);
      if (!stripeErr && stripeSub) {
        await upsertSubscription({
          user_id: userId,
          stripe_customer_id: subscription.stripe_customer_id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          status: stripeSub.status,
          plan_id: subscription.plan_id || 'basic',
          current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
        });
        const { subscription: fresh } = await getUserSubscription(userId);
        subscriptionForResponse = fresh || subscription;
      }
    }

    const isActive = await hasActiveSubscription(userId);
    const effectivePlanId = await getEffectivePlanId(userId);
    const plan = SUBSCRIPTION_PLANS[effectivePlanId];

    const { stats: usageStats, error: usageError } = await getUsageStats(userId);
    const limitCheck = await canGenerateResume(userId);

    return res.json({
      subscription: subscriptionForResponse || null,
      isActive,
      plan: effectivePlanId,
      limits: plan?.limits || { resumesPerMonth: 10 },
      usage: usageStats ? {
        used: usageStats.used,
        limit: plan?.limits?.resumesPerMonth ?? 10,
        remaining: limitCheck.remaining,
        periodStart: usageStats.periodStart,
        periodEnd: usageStats.periodEnd,
      } : null,
    });
  } catch (err) {
    console.error('❌ Error getting subscription status:', err);
    return res.status(500).json({ error: err?.message || 'Failed to get subscription status' });
  }
});

// Create Stripe Checkout Session
subscriptionRouter.post('/checkout', async (req, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  if (!userId || !userEmail) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const parsed = createCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { planId } = parsed.data;

  try {
    const { session, error } = await createCheckoutSession(userId, userEmail, planId);

    if (error || !session) {
      return res.status(500).json({ 
        error: error?.message || 'Failed to create checkout session' 
      });
    }

    return res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error('❌ Error creating checkout:', err);
    return res.status(500).json({ error: err?.message || 'Failed to create checkout session' });
  }
});

// Confirm subscription from success page (fallback when webhook misses or is delayed).
// Frontend MUST call this when the user lands on the subscription success page with the
// checkout session_id from the URL (e.g. /subscription/success?session_id=cs_xxx). Send
// body: { sessionId: "<session_id from URL>" } so the backend can create/update the
// subscription row immediately even if the webhook has not run yet.
subscriptionRouter.post('/from-session', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const sessionId = req.body?.sessionId ?? req.body?.session_id ?? req.query?.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing sessionId (from checkout success URL session_id)' });
  }

  try {
    const { session, error: fetchErr } = await getCheckoutSession(sessionId, ['subscription']);
    if (fetchErr || !session) {
      return res.status(400).json({
        error: 'Invalid or expired checkout session',
        details: fetchErr?.message,
      });
    }

    const sessionUserId = session.client_reference_id || session.metadata?.userId;
    if (String(sessionUserId) !== String(userId)) {
      return res.status(403).json({ error: 'This checkout session does not belong to the current user' });
    }

    if (session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Not a subscription checkout session' });
    }

    const customerId = normalizeStripeId(session.customer);
    const subscriptionId = normalizeStripeId(session.subscription);
    if (!customerId || !subscriptionId) {
      return res.status(400).json({ error: 'Checkout session missing customer or subscription' });
    }

    let status;
    let currentPeriodStart;
    let currentPeriodEnd;
    let cancelAtPeriodEnd = false;

    if (session.subscription && typeof session.subscription === 'object') {
      const sub = session.subscription;
      status = sub.status;
      currentPeriodStart = sub.current_period_start;
      currentPeriodEnd = sub.current_period_end;
      cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
    } else {
      const { subscription: stripeSub, error: subErr } = await getStripeSubscription(subscriptionId);
      if (subErr || !stripeSub) {
        return res.status(500).json({
          error: 'Failed to load subscription from Stripe',
          details: subErr?.message,
        });
      }
      status = stripeSub.status;
      currentPeriodStart = stripeSub.current_period_start;
      currentPeriodEnd = stripeSub.current_period_end;
      cancelAtPeriodEnd = stripeSub.cancel_at_period_end ?? false;
    }

    const planId = session.metadata?.planId || 'basic';
    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status,
      plan_id: planId,
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      cancel_at_period_end: cancelAtPeriodEnd,
    };

    const { data: updated, error: upsertError } = await upsertSubscription(subscriptionData);
    if (upsertError) {
      console.error('❌ from-session upsert failed:', upsertError);
      return res.status(500).json({
        error: 'Failed to save subscription',
        details: upsertError.message,
      });
    }

    const isActive = await hasActiveSubscription(userId);
    return res.json({
      success: true,
      message: 'Subscription confirmed',
      subscription: updated,
      isActive,
      plan: planId,
    });
  } catch (err) {
    console.error('❌ Error confirming subscription from session:', err);
    return res.status(500).json({ error: err?.message || 'Failed to confirm subscription' });
  }
});

// Create Stripe Customer Portal Session (for managing subscriptions)
subscriptionRouter.post('/portal', async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const parsed = portalSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    // Get user's subscription to find Stripe customer ID
    const { subscription, error: subError } = await getUserSubscription(userId);
    
    if (subError || !subscription?.stripe_customer_id) {
      return res.status(404).json({ 
        error: 'No active subscription found. Please create a subscription first.' 
      });
    }

    const { session, error } = await createPortalSession(
      subscription.stripe_customer_id,
      parsed.data.returnUrl
    );

    if (error || !session) {
      return res.status(500).json({ 
        error: error?.message || 'Failed to create portal session' 
      });
    }

    return res.json({
      url: session.url,
    });
  } catch (err) {
    console.error('❌ Error creating portal session:', err);
    return res.status(500).json({ error: err?.message || 'Failed to create portal session' });
  }
});

// Recover subscription from Stripe by user email when DB has no row (e.g. webhook and from-session both missed)
subscriptionRouter.post('/recover', async (req, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  if (!userId || !userEmail) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { subscription: dbSubscription } = await getUserSubscription(userId);
    if (dbSubscription?.stripe_subscription_id) {
      return res.status(400).json({
        error: 'Subscription already in database. Use POST /sync to refresh.',
        hasSubscription: true,
      });
    }

    const { subscription: stripeSub, customerId, planId, error: findErr } = await findSubscriptionByCustomerEmail(userEmail);
    if (findErr || !stripeSub || !customerId) {
      return res.status(404).json({
        error: 'No active Stripe subscription found for this email.',
        hasSubscription: false,
      });
    }

    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSub.id,
      status: stripeSub.status,
      plan_id: planId || 'basic',
      current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
    };

    const { data: updated, error: upsertError } = await upsertSubscription(subscriptionData);
    if (upsertError) {
      return res.status(500).json({ error: 'Failed to save subscription', details: upsertError.message });
    }

    const isActive = await hasActiveSubscription(userId);
    return res.json({
      success: true,
      message: 'Subscription recovered from Stripe',
      subscription: updated,
      isActive,
      plan: planId || 'basic',
    });
  } catch (err) {
    console.error('❌ Error recovering subscription:', err);
    return res.status(500).json({ error: err?.message || 'Failed to recover subscription' });
  }
});

// Manual sync subscription from Stripe (for recovery/debugging)
subscriptionRouter.post('/sync', async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Get existing subscription from database
    const { subscription: dbSubscription, error: dbError } = await getUserSubscription(userId);
    
    if (dbError && dbError.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to fetch subscription from database' });
    }

    // If no subscription in DB, try recover first
    if (!dbSubscription || !dbSubscription.stripe_subscription_id) {
      return res.status(404).json({ 
        error: 'No subscription found. Try POST /api/subscription/recover to recover from Stripe by email.',
        hasSubscription: false
      });
    }

    // Fetch latest subscription data from Stripe
    const { subscription: stripeSub, error: stripeError } = await getStripeSubscription(dbSubscription.stripe_subscription_id);
    
    if (stripeError || !stripeSub) {
      return res.status(500).json({ 
        error: 'Failed to fetch subscription from Stripe',
        details: stripeError?.message 
      });
    }

    // Update database with latest Stripe data
    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: dbSubscription.stripe_customer_id,
      stripe_subscription_id: stripeSub.id,
      status: stripeSub.status,
      plan_id: dbSubscription.plan_id || 'basic', // Preserve existing plan_id
      current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: stripeSub.cancel_at_period_end || false,
    };

    const { data: updatedSubscription, error: upsertError } = await upsertSubscription(subscriptionData);
    
    if (upsertError) {
      return res.status(500).json({ 
        error: 'Failed to update subscription in database',
        details: upsertError.message 
      });
    }

    const isActive = await hasActiveSubscription(userId);

    return res.json({
      success: true,
      message: 'Subscription synced successfully',
      subscription: updatedSubscription,
      isActive,
      plan: updatedSubscription?.plan_id || 'free',
      stripeStatus: stripeSub.status,
    });
  } catch (err) {
    console.error('❌ Error syncing subscription:', err);
    return res.status(500).json({ error: err?.message || 'Failed to sync subscription' });
  }
});

// Get usage and limits for current user
subscriptionRouter.get('/usage', async (req, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // If no subscription row, try to recover from Stripe by email so plan/limits are correct
    const { subscription } = await getUserSubscription(userId);
    if (!subscription?.stripe_subscription_id && userEmail) {
      await tryRecoverSubscriptionFromStripe(userId, userEmail);
    }

    const effectivePlanId = await getEffectivePlanId(userId);
    const plan = SUBSCRIPTION_PLANS[effectivePlanId];
    const { stats: usageStats, error: usageError } = await getUsageStats(userId);
    const limitCheck = await canGenerateResume(userId);

    console.log(`📊 /api/subscription/usage endpoint called for user ${userId}`);
    console.log(`   Plan: ${effectivePlanId}`);
    console.log(`   Usage Stats:`, usageStats);
    console.log(`   Limit Check:`, limitCheck);

    if (usageError) {
      console.error('❌ Usage stats error:', usageError);
      return res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }

    const limit = plan?.limits?.resumesPerMonth || 10;

    const response = {
      plan: effectivePlanId,
      limit: limit === -1 ? null : limit, // null means unlimited
      used: usageStats?.used || 0,
      remaining: limitCheck.remaining,
      canGenerate: limitCheck.allowed,
      periodStart: usageStats?.periodStart,
      periodEnd: usageStats?.periodEnd,
    };
    
    console.log(`📊 Returning usage response:`, response);
    return res.json(response);
  } catch (err) {
    console.error('❌ Error getting usage:', err);
    return res.status(500).json({ error: err?.message || 'Failed to get usage' });
  }
});

// Webhook is handled directly in server.js to use raw body

