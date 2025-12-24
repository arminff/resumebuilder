import { Router } from 'express';
import { createCheckoutSchema, portalSessionSchema } from '../utils/schemas.js';
import { createCheckoutSession, createPortalSession, SUBSCRIPTION_PLANS } from '../utils/stripe.js';
import { getUserSubscription, upsertSubscription, hasActiveSubscription, getUsageStats, canGenerateResume } from '../utils/supabase.js';
import { getStripeSubscription, getStripeCustomer } from '../utils/stripe.js';

export const subscriptionRouter = Router();

// Get available subscription plans
subscriptionRouter.get('/plans', (_req, res) => {
  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    features: plan.features,
    limits: plan.limits,
  }));

  return res.json({ plans });
});

// Get current user's subscription status
subscriptionRouter.get('/status', async (req, res) => {
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { subscription, error } = await getUserSubscription(userId);
    
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to fetch subscription status' });
    }

    const isActive = await hasActiveSubscription(userId);
    const planId = subscription?.plan_id || 'free';
    const plan = SUBSCRIPTION_PLANS[planId];
    
    // Get usage statistics
    const { stats: usageStats, error: usageError } = await getUsageStats(userId);
    const limitCheck = await canGenerateResume(userId);

    return res.json({
      subscription: subscription || null,
      isActive,
      plan: planId,
      limits: plan?.limits || { resumesPerMonth: 5 },
      usage: usageStats ? {
        used: usageStats.used,
        limit: plan?.limits?.resumesPerMonth || 5,
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

    // If no subscription in DB, can't sync
    if (!dbSubscription || !dbSubscription.stripe_subscription_id) {
      return res.status(404).json({ 
        error: 'No subscription found. Please create a subscription first.',
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
  
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { subscription } = await getUserSubscription(userId);
    const planId = subscription?.plan_id || 'free';
    const plan = SUBSCRIPTION_PLANS[planId];
    const { stats: usageStats, error: usageError } = await getUsageStats(userId);
    const limitCheck = await canGenerateResume(userId);

    console.log(`📊 /api/subscription/usage endpoint called for user ${userId}`);
    console.log(`   Plan: ${planId}`);
    console.log(`   Usage Stats:`, usageStats);
    console.log(`   Limit Check:`, limitCheck);

    if (usageError) {
      console.error('❌ Usage stats error:', usageError);
      return res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }

    const limit = plan?.limits?.resumesPerMonth || 5;

    const response = {
      plan: planId,
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

