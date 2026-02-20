import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.warn('⚠️ Stripe secret key not configured. Subscription features will not work.');
}

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
}) : null;

export { stripeWebhookSecret };

// Subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    priceId: null, // Free plan doesn't have a Stripe price ID
    priceLabel: 'Free',
    features: ['10 resumes per month', 'Basic templates'],
    limits: {
      resumesPerMonth: 10
    }
  },
  basic: {
    name: 'Basic',
    priceId: process.env.STRIPE_PRICE_ID_BASIC,
    priceLabel: process.env.STRIPE_PRICE_LABEL_BASIC || 'See Stripe',
    features: ['50 resumes per month', 'All templates', 'Priority support'],
    limits: {
      resumesPerMonth: 50
    }
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro_monthly',
    priceLabel: process.env.STRIPE_PRICE_LABEL_PRO || 'Custom',
    features: ['Unlimited resumes', 'All templates', 'Priority support', 'Custom branding'],
    limits: {
      resumesPerMonth: -1 // -1 means unlimited
    }
  }
};

// Create Stripe Checkout Session
export async function createCheckoutSession(userId, userEmail, planId) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan || !plan.priceId) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  const successUrl = process.env.STRIPE_SUCCESS_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      client_reference_id: userId, // Link to Supabase user ID
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        planId,
      },
    });

    return { session, error: null };
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    return { session: null, error };
  }
}

// Create Stripe Customer Portal Session (for managing subscriptions)
export async function createPortalSession(customerId, returnUrl) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
    });

    return { session, error: null };
  } catch (error) {
    console.error('❌ Error creating portal session:', error);
    return { session: null, error };
  }
}

// Verify webhook signature
export function verifyWebhookSignature(payload, signature) {
  if (!stripe || !stripeWebhookSecret) {
    throw new Error('Stripe or webhook secret not configured');
  }

  try {
    // payload can be a Buffer or string
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeWebhookSecret
    );
    return { event, error: null };
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error.message);
    return { event: null, error };
  }
}

// Get subscription from Stripe
export async function getStripeSubscription(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return { subscription, error: null };
  } catch (error) {
    console.error('❌ Error retrieving subscription:', error);
    return { subscription: null, error };
  }
}

// Get customer from Stripe
export async function getStripeCustomer(customerId) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    return { customer, error: null };
  } catch (error) {
    console.error('❌ Error retrieving customer:', error);
    return { customer: null, error };
  }
}

// Retrieve Checkout Session with optional expand (e.g. subscription for subscription-mode sessions)
export async function getCheckoutSession(sessionId, expand = []) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: expand.length ? expand : undefined,
    });
    return { session, error: null };
  } catch (error) {
    console.error('❌ Error retrieving checkout session:', error);
    return { session: null, error };
  }
}

// Find an active/trialing subscription for a Stripe customer by email (for recovery when DB has no row)
export async function findSubscriptionByCustomerEmail(email) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data?.length) return { subscription: null, customerId: null, planId: null, error: null };

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    // If no active, try trialing
    let list = subscriptions.data;
    if (!list?.length) {
      const trialing = await stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 1 });
      list = trialing.data;
    }
    if (!list?.length) return { subscription: null, customerId, planId: null, error: null };

    const subscription = list[0];
    const priceId = subscription.items?.data?.[0]?.price?.id || '';
    const planId = priceId === (process.env.STRIPE_PRICE_ID_PRO || '') ? 'pro'
      : priceId === (process.env.STRIPE_PRICE_ID_BASIC || '') ? 'basic'
      : 'basic';
    return { subscription, customerId, planId, error: null };
  } catch (error) {
    console.error('❌ Error finding subscription by email:', error);
    return { subscription: null, customerId: null, planId: null, error };
  }
}

