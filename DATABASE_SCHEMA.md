# Database Schema for Subscriptions

This document describes the Supabase database schema required for the subscription system.

## Table: `subscriptions`

Stores user subscription information synced from Stripe webhooks.

### Schema

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'active', 'trialing', 'past_due', 'canceled', 'unpaid'
  plan_id TEXT NOT NULL, -- 'free', 'basic', 'pro'
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at 
  BEFORE UPDATE ON subscriptions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

### Column Descriptions

- `id`: Primary key (UUID)
- `user_id`: Foreign key to `auth.users(id)` - links to Supabase user
- `stripe_customer_id`: Stripe customer ID (unique)
- `stripe_subscription_id`: Stripe subscription ID (unique)
- `status`: Subscription status from Stripe:
  - `active`: Subscription is active
  - `trialing`: In trial period
  - `past_due`: Payment failed but subscription still active
  - `canceled`: Subscription canceled
  - `unpaid`: Subscription unpaid
- `plan_id`: Plan identifier (`free`, `basic`, `pro`)
- `current_period_start`: Start of current billing period
- `current_period_end`: End of current billing period
- `cancel_at_period_end`: Whether subscription will cancel at period end
- `created_at`: Record creation timestamp
- `updated_at`: Record last update timestamp

## Row Level Security (RLS)

Enable RLS and create policies:

```sql
-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role full access"
  ON subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');
```

## Setup Instructions

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the schema creation script**
   - Copy and paste the schema SQL above
   - Execute the script

3. **Verify the table**
   - Check that the `subscriptions` table was created
   - Verify indexes and triggers are in place

4. **Test RLS policies**
   - Ensure users can only see their own subscriptions
   - Verify service role has full access

## Notes

- The `user_id` column references `auth.users(id)` which is managed by Supabase Auth
- The table uses `ON DELETE CASCADE` so if a user is deleted, their subscription record is also deleted
- The `updated_at` column is automatically updated via trigger
- All Stripe IDs are stored as TEXT to handle Stripe's ID format

