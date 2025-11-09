import { Router } from 'express';
import { createCheckoutSchema, portalSessionSchema } from '../utils/schemas.js';
import { createCheckoutSession, createPortalSession, SUBSCRIPTION_PLANS } from '../utils/stripe.js';
import { getUserSubscription, upsertSubscription, hasActiveSubscription } from '../utils/supabase.js';
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

    return res.json({
      subscription: subscription || null,
      isActive,
      plan: subscription?.plan_id || 'free',
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

// Webhook is handled directly in server.js to use raw body

