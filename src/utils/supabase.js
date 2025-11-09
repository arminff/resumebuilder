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
    return { error: new Error('Supabase admin not configured') };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error upserting subscription:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('❌ Exception upserting subscription:', err);
    return { data: null, error: err };
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

