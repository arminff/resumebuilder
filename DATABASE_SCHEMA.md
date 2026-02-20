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

## Table: `resume_usage`

Stores one row per resume generation per user per billing period. Used with `subscriptions` (or calendar month for free users) to enforce plan limits.

### Schema

```sql
-- resume_usage: one row per resume generation per user per billing period
CREATE TABLE IF NOT EXISTS resume_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_usage_user_period ON resume_usage(user_id, period_start, period_end);
```

### Column Descriptions

- `id`: Primary key (UUID)
- `user_id`: Foreign key to `auth.users(id)` - links to Supabase user
- `period_start`: Start of the billing period this usage belongs to
- `period_end`: End of the billing period
- `generated_at`: When the resume was generated

### RLS for `resume_usage`

If users should only read their own usage (e.g. for a usage dashboard), enable RLS and add policies:

```sql
ALTER TABLE resume_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resume usage"
  ON resume_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access resume_usage"
  ON resume_usage
  FOR ALL
  USING (auth.role() = 'service_role');
```

The backend uses the service role to insert and count rows; authenticated users only need SELECT on their own rows if you expose usage in the API.

### How "used" and "remaining" work

- **Resume usage (used)** is not a single column; it is the **count of rows** in `resume_usage` for the current user and current billing period (from `subscriptions.current_period_start/end` or calendar month for free users). The backend does this in `getResumeUsageCount()`.
- **Remaining resumes** are **not stored** in Supabase. They are **computed at runtime** in the backend as `remaining = plan_limit - used` (where the plan limit comes from the subscription plan, e.g. 10 for free, 50 for basic, unlimited for pro). So there is no table or column for "remaining" — only the `resume_usage` table and the plan limits (in app config) are needed.

## Setup Instructions

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the schema creation scripts**
   - Run the `subscriptions` table SQL (and its indexes, trigger, RLS) first
   - Run the `resume_usage` table SQL (and index, RLS if needed) second

3. **Verify the tables**
   - Check that the `subscriptions` table was created with indexes and triggers
   - Check that the `resume_usage` table was created with its index

4. **Test RLS policies**
   - Ensure users can only see their own subscriptions and (if enabled) their own resume_usage
   - Verify service role has full access to both tables

## Notes

- The `user_id` column references `auth.users(id)` which is managed by Supabase Auth
- The table uses `ON DELETE CASCADE` so if a user is deleted, their subscription record is also deleted
- The `updated_at` column is automatically updated via trigger
- All Stripe IDs are stored as TEXT to handle Stripe's ID format

