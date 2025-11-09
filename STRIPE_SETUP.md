# Stripe Subscription Setup Guide

Complete guide for setting up Stripe subscriptions with Supabase in the Resume Builder backend.

## Prerequisites

1. **Stripe Account**: Sign up at https://stripe.com
2. **Supabase Project**: With database access
3. **Backend Server**: Running and accessible for webhooks

## Step 1: Stripe Setup

### 1.1 Create Products and Prices

1. Go to Stripe Dashboard → Products
2. Create products for your plans:

   **Basic Plan:**
   - Name: "Basic Plan"
   - Type: Recurring
   - Billing period: Monthly (or your preference)
   - Price: Set your price
   - Copy the **Price ID** (starts with `price_`)

   **Pro Plan:**
   - Name: "Pro Plan"
   - Type: Recurring
   - Billing period: Monthly
   - Price: Set your price
   - Copy the **Price ID** (starts with `price_`)

### 1.2 Get API Keys

1. Go to Stripe Dashboard → Developers → API keys
2. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for production)
3. Keep this secure - never expose to frontend!

### 1.3 Set Up Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter your webhook URL:
   ```
   https://your-domain.com/api/subscription/webhook
   ```
   For local testing, use Stripe CLI (see below)
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

### 1.4 Local Testing with Stripe CLI

For local development, use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Linux: See https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:4000/api/subscription/webhook

# Copy the webhook signing secret shown (whsec_...)
```

## Step 2: Supabase Setup

### 2.1 Create Database Table

1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `DATABASE_SCHEMA.md`:

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

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

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything
CREATE POLICY "Service role full access"
  ON subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');
```

### 2.2 Get Service Role Key

1. Go to Supabase Dashboard → Settings → API
2. Copy the **service_role** key (NOT the anon key!)
3. This key has admin privileges - keep it secret!

## Step 3: Environment Variables

Add these to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID_BASIC=price_your_basic_price_id
STRIPE_PRICE_ID_PRO=price_your_pro_price_id

# Stripe URLs (optional)
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
FRONTEND_URL=http://localhost:3000

# Supabase Service Role (for backend operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 4: Install Dependencies

```bash
npm install
```

This will install the `stripe` package.

## Step 5: Test the Integration

### 5.1 Test Checkout Session Creation

```bash
curl -X POST http://localhost:4000/api/subscription/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "planId": "basic"
  }'
```

Response:
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### 5.2 Test Subscription Status

```bash
curl -X GET http://localhost:4000/api/subscription/status \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

Response:
```json
{
  "subscription": {
    "user_id": "...",
    "stripe_customer_id": "cus_...",
    "status": "active",
    "plan_id": "basic",
    ...
  },
  "isActive": true,
  "plan": "basic"
}
```

### 5.3 Test Webhook (using Stripe CLI)

```bash
# In one terminal, forward webhooks
stripe listen --forward-to localhost:4000/api/subscription/webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

Check your server logs for webhook processing.

## API Endpoints

### GET `/api/subscription/plans`
Get available subscription plans.

**Response:**
```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "features": ["5 resumes per month", "Basic templates"],
      "limits": { "resumesPerMonth": 5 }
    },
    {
      "id": "basic",
      "name": "Basic",
      "features": ["50 resumes per month", "All templates", "Priority support"],
      "limits": { "resumesPerMonth": 50 }
    },
    {
      "id": "pro",
      "name": "Pro",
      "features": ["Unlimited resumes", "All templates", "Priority support", "Custom branding"],
      "limits": { "resumesPerMonth": -1 }
    }
  ]
}
```

### GET `/api/subscription/status`
Get current user's subscription status.

**Headers:**
- `Authorization: Bearer <supabase_token>`

**Response:**
```json
{
  "subscription": {
    "user_id": "uuid",
    "stripe_customer_id": "cus_...",
    "stripe_subscription_id": "sub_...",
    "status": "active",
    "plan_id": "basic",
    "current_period_start": "2024-01-01T00:00:00Z",
    "current_period_end": "2024-02-01T00:00:00Z",
    "cancel_at_period_end": false
  },
  "isActive": true,
  "plan": "basic"
}
```

### POST `/api/subscription/checkout`
Create Stripe Checkout Session.

**Headers:**
- `Authorization: Bearer <supabase_token>`

**Body:**
```json
{
  "planId": "basic" // or "pro"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### POST `/api/subscription/portal`
Create Stripe Customer Portal session (for managing subscriptions).

**Headers:**
- `Authorization: Bearer <supabase_token>`

**Body:**
```json
{
  "returnUrl": "http://localhost:3000" // optional
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

### POST `/api/subscription/webhook`
Stripe webhook endpoint (no auth - verified via signature).

**Headers:**
- `stripe-signature: ...` (from Stripe)

**Body:** Raw JSON from Stripe

## Security Best Practices

1. ✅ **Never expose Stripe secret key** - Keep it in `.env` on backend only
2. ✅ **Always verify webhook signatures** - Done automatically in the code
3. ✅ **Use service role key only on backend** - Never expose to frontend
4. ✅ **Enable RLS on Supabase table** - Users can only see their own subscriptions
5. ✅ **Use HTTPS in production** - Required for Stripe webhooks
6. ✅ **Validate all inputs** - Zod schemas validate request bodies

## Troubleshooting

### Webhook not receiving events
- Check webhook URL is correct in Stripe dashboard
- Verify webhook secret matches `.env`
- Check server logs for errors
- Use Stripe CLI for local testing

### Subscription not updating in database
- Check webhook events are being received
- Verify service role key has correct permissions
- Check database RLS policies
- Review server logs for errors

### Checkout session creation fails
- Verify Stripe secret key is correct
- Check price IDs match your Stripe products
- Ensure user is authenticated (valid JWT)

## Production Checklist

- [ ] Switch to Stripe live mode keys
- [ ] Update webhook URL to production domain
- [ ] Set up production webhook endpoint in Stripe
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Test full subscription flow end-to-end
- [ ] Set up monitoring for webhook failures
- [ ] Configure error alerts

