import { createClient } from '@supabase/supabase-js';

// Service role client for backend operations (has admin privileges)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase service role key not configured. Subscription features will not work.');
}

// Service role client for backend database operations
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Get user subscription from database
export async function getUserSubscription(userId) {
  if (!supabaseAdmin) {
    return { subscription: null, error: new Error('Supabase admin not configured') };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error fetching subscription:', error);
      return { subscription: null, error };
    }

    return { subscription: data || null, error: null };
  } catch (err) {
    console.error('❌ Exception fetching subscription:', err);
    return { subscription: null, error: err };
  }
}

// Update or create subscription record
export async function upsertSubscription(subscriptionData) {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return { data: null, error: new Error('Supabase admin not configured') };
  }

  // Validate required fields
  if (!subscriptionData.user_id) {
    console.error('❌ Missing user_id in subscription data');
    return { data: null, error: new Error('Missing user_id') };
  }

  const source = subscriptionData.source ?? 'stripe';
  if (source === 'stripe') {
    if (!subscriptionData.stripe_customer_id) {
      console.error('❌ Missing stripe_customer_id in subscription data');
      return { data: null, error: new Error('Missing stripe_customer_id') };
    }
    if (!subscriptionData.stripe_subscription_id) {
      console.error('❌ Missing stripe_subscription_id in subscription data');
      return { data: null, error: new Error('Missing stripe_subscription_id') };
    }
  }
  // When source === 'apple', stripe_customer_id and stripe_subscription_id may be null

  console.log('💾 Attempting to upsert subscription:', {
    user_id: subscriptionData.user_id,
    plan_id: subscriptionData.plan_id,
    status: subscriptionData.status,
    source,
    stripe_customer_id: subscriptionData.stripe_customer_id ?? null,
    stripe_subscription_id: subscriptionData.stripe_subscription_id ?? null
  });

  try {
    // Normalize payload: ensure source and optional Apple/Stripe fields are set for DB
    const payload = {
      ...subscriptionData,
      source: subscriptionData.source ?? 'stripe',
      stripe_customer_id: subscriptionData.stripe_customer_id ?? null,
      stripe_subscription_id: subscriptionData.stripe_subscription_id ?? null,
    };
    if (subscriptionData.apple_original_transaction_id !== undefined) {
      payload.apple_original_transaction_id = subscriptionData.apple_original_transaction_id;
    }

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(payload, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase upsert error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Subscription data attempted:', subscriptionData);
      return { data: null, error };
    }

    if (!data) {
      console.error('❌ Upsert succeeded but no data returned');
      return { data: null, error: new Error('No data returned from upsert') };
    }

    console.log('✅ Subscription upserted successfully:', {
      id: data.id,
      user_id: data.user_id,
      plan_id: data.plan_id,
      status: data.status
    });

    return { data, error: null };
  } catch (err) {
    console.error('❌ Exception upserting subscription:', err);
    console.error('Exception stack:', err.stack);
    console.error('Subscription data attempted:', subscriptionData);
    return { data: null, error: err };
  }
}

// Delete subscription row (e.g. when Stripe subscription no longer exists and recover finds nothing)
export async function deleteSubscription(userId) {
  if (!supabaseAdmin) {
    return { error: new Error('Supabase admin not configured') };
  }
  try {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);
    return { error: error || null };
  } catch (err) {
    console.error('❌ Exception deleting subscription:', err);
    return { error: err };
  }
}

// Check if user has active subscription
export async function hasActiveSubscription(userId) {
  const { subscription, error } = await getUserSubscription(userId);

  if (error || !subscription) {
    return false;
  }

  // Check if subscription is active and not expired
  const now = new Date();
  const status = subscription.status;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : null;

  const isActive = status === 'active' || status === 'trialing';
  const notExpired = !currentPeriodEnd || currentPeriodEnd > now;

  return isActive && notExpired;
}

/**
 * Plan ID used for limits and billing. When subscription is canceled, expired, or past_due,
 * the user falls back to free tier (they are not stuck on the previous paid plan).
 */
export async function getEffectivePlanId(userId) {
  const isActive = await hasActiveSubscription(userId);
  if (!isActive) return 'free';

  const { subscription } = await getUserSubscription(userId);
  const planId = subscription?.plan_id || 'free';
  return planId === 'basic' || planId === 'pro' ? planId : 'free';
}

// Get current billing period for a user
export async function getCurrentBillingPeriod(userId) {
  const { subscription } = await getUserSubscription(userId);
  
  if (subscription && subscription.current_period_start && subscription.current_period_end) {
    return {
      periodStart: new Date(subscription.current_period_start),
      periodEnd: new Date(subscription.current_period_end),
    };
  }
  
  // For free users, use calendar month
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return { periodStart, periodEnd };
}

// Get resume usage count for current period
export async function getResumeUsageCount(userId) {
  if (!supabaseAdmin) {
    return { count: 0, error: new Error('Supabase admin not configured') };
  }

  try {
    const { periodStart, periodEnd } = await getCurrentBillingPeriod(userId);
    
    console.log(`📊 Counting usage for user ${userId}`);
    console.log(`📊 Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    // Query by period_start/period_end (more reliable - matches the period the record was created for)
    // This ensures we match records based on the billing period they were recorded for
    const { count, error } = await supabaseAdmin
      .from('resume_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString());

    if (error) {
      console.error('❌ Error counting resume usage:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return { count: 0, error };
    }

    console.log(`✅ Usage count: ${count || 0}`);
    return { count: count || 0, error: null };
  } catch (err) {
    console.error('❌ Exception counting resume usage:', err);
    return { count: 0, error: err };
  }
}

// Record a resume generation
export async function recordResumeGeneration(userId) {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return { data: null, error: new Error('Supabase admin not configured') };
  }

  try {
    const { periodStart, periodEnd } = await getCurrentBillingPeriod(userId);
    
    const recordData = {
      user_id: userId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      generated_at: new Date().toISOString(),
    };
    
    console.log(`📝 Recording usage for user ${userId}:`, recordData);
    
    const { data, error } = await supabaseAdmin
      .from('resume_usage')
      .insert(recordData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error recording resume generation:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      console.error('❌ Attempted data:', JSON.stringify(recordData, null, 2));
      return { data: null, error };
    }

    console.log(`✅ Usage recorded successfully:`, data);
    return { data, error: null };
  } catch (err) {
    console.error('❌ Exception recording resume generation:', err);
    return { data: null, error: err };
  }
}

// Get usage statistics for a user (uses effective plan: free when subscription inactive)
export async function getUsageStats(userId) {
  if (!supabaseAdmin) {
    return { stats: null, error: new Error('Supabase admin not configured') };
  }

  try {
    const { periodStart, periodEnd } = await getCurrentBillingPeriod(userId);
    const { count, error: countError } = await getResumeUsageCount(userId);

    if (countError) {
      return { stats: null, error: countError };
    }

    const planId = await getEffectivePlanId(userId);

    return {
      stats: {
        used: count,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        planId,
      },
      error: null
    };
  } catch (err) {
    console.error('❌ Exception getting usage stats:', err);
    return { stats: null, error: err };
  }
}

// Check if user can generate a resume (within limits; uses effective plan: free when subscription inactive)
export async function canGenerateResume(userId) {
  try {
    const { SUBSCRIPTION_PLANS } = await import('./stripe.js');
    const { count, error } = await getResumeUsageCount(userId);

    const planId = await getEffectivePlanId(userId);
    const plan = SUBSCRIPTION_PLANS[planId];
    const limit = plan?.limits?.resumesPerMonth || 10;
    
    console.log(`📊 Usage Check for user ${userId}:`);
    console.log(`   Plan: ${planId}`);
    console.log(`   Limit: ${limit === -1 ? 'unlimited' : limit}`);
    console.log(`   Used: ${count}`);
    
    if (error) {
      console.error('❌ Error checking usage:', error);
      // On error, allow generation (fail open) but log it
      return { allowed: true, used: count, limit, remaining: limit === -1 ? -1 : limit, error: 'Could not verify usage limit' };
    }

    if (!plan) {
      console.error('❌ Unknown plan:', planId);
      return { allowed: false, used: count, limit, remaining: 0, error: 'Unknown subscription plan' };
    }
    
    // -1 means unlimited
    if (limit === -1) {
      console.log(`   Remaining: unlimited`);
      return { allowed: true, used: count, limit: -1, remaining: -1 };
    }

    const remaining = limit - count;
    const allowed = remaining > 0;
    
    console.log(`   Remaining: ${remaining}`);
    console.log(`   Can Generate: ${allowed}`);

    return {
      allowed,
      used: count,
      limit,
      remaining: Math.max(0, remaining),
      error: allowed ? null : 'Resume generation limit exceeded'
    };
  } catch (err) {
    console.error('❌ Exception checking resume generation limit:', err);
    // Fail open on exception
    return { allowed: true, used: 0, limit: 10, remaining: 10, error: 'Could not verify limit' };
  }
}

