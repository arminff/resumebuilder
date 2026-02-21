-- iOS In-App Purchase (IAP) support: extend subscriptions table for Apple
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query) or via Supabase CLI.
-- Existing Stripe subscriptions are unchanged; backfill sets source = 'stripe'.

-- 1. Add source column: 'stripe' | 'apple'
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'stripe';

-- 2. Allow NULL for Stripe columns on Apple rows (PostgreSQL UNIQUE allows multiple NULLs)
ALTER TABLE subscriptions
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

ALTER TABLE subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL;

-- 3. Optional: idempotency for Apple verify-receipt (avoid duplicate grants)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT;

-- 4. Backfill existing rows (all current rows are Stripe)
UPDATE subscriptions
SET source = 'stripe'
WHERE source IS NULL OR source = '';

-- 5. Ensure only valid values (optional constraint)
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_source_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_source_check
  CHECK (source IN ('stripe', 'apple'));
