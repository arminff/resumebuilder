import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authMiddleware } from './utils/auth.js';
import { resumeRouter } from './routes/resume.js';
import { scrapeRouter } from './routes/scrape.js';
import { subscriptionRouter } from './routes/subscription.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Stripe webhook endpoint (NO AUTH - verified via signature)
// Must be before auth middleware and use raw body
app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  // req.body is already a Buffer from express.raw()
  const rawBody = req.body;
  
  try {
    const { verifyWebhookSignature } = await import('./utils/stripe.js');
    const { event, error } = verifyWebhookSignature(rawBody, signature);

    if (error || !event) {
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log(`📥 Webhook received: ${event.type}`);

    // Import subscription utilities
    const { upsertSubscription } = await import('./utils/supabase.js');
    const { getStripeSubscription, getStripeCustomer } = await import('./utils/stripe.js');
    const { supabaseAdmin } = await import('./utils/supabase.js');

    // Handle different webhook events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer;

        if (!userId || !customerId) {
          console.error('❌ Missing userId or customerId in checkout session');
          break;
        }

        // Get subscription details from Stripe
        const subscriptionId = session.subscription;
        if (subscriptionId) {
          const { subscription: stripeSub, error: subError } = await getStripeSubscription(subscriptionId);
          
          if (subError || !stripeSub) {
            console.error('❌ Error fetching subscription from Stripe:', subError);
            break;
          }

          // Update subscription in database
          const subscriptionData = {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: stripeSub.status,
            plan_id: session.metadata?.planId || 'basic',
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: stripeSub.cancel_at_period_end,
          };

          const { error: upsertError } = await upsertSubscription(subscriptionData);
          if (upsertError) {
            console.error('❌ Error upserting subscription:', upsertError);
          } else {
            console.log(`✅ Subscription created/updated for user: ${userId}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSubscription = event.data.object;
        const customerId = stripeSubscription.customer;

        // Find user by customer ID
        const { customer, error: custError } = await getStripeCustomer(customerId);
        if (custError || !customer) {
          console.error('❌ Error fetching customer:', custError);
          break;
        }

        // Get user subscription by customer ID
        if (!supabaseAdmin) break;

        const { data: subscription, error: subError } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (subError || !subscription) {
          console.error('❌ Subscription not found in database');
          break;
        }

        const subscriptionData = {
          user_id: subscription.user_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscription.id,
          status: stripeSubscription.status,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        };

        if (event.type === 'customer.subscription.deleted') {
          subscriptionData.status = 'canceled';
        }

        const { error: upsertError } = await upsertSubscription(subscriptionData);
        if (upsertError) {
          console.error('❌ Error updating subscription:', upsertError);
        } else {
          console.log(`✅ Subscription ${event.type} for user: ${subscription.user_id}`);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          const { subscription: stripeSub, error: subError } = await getStripeSubscription(subscriptionId);
          if (subError || !stripeSub) break;

          // Get user subscription by customer ID
          if (!supabaseAdmin) break;

          const { data: subscription, error: subError2 } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (subError2 || !subscription) break;

          const subscriptionData = {
            user_id: subscription.user_id,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: stripeSub.status,
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: stripeSub.cancel_at_period_end,
          };

          const { error: upsertError } = await upsertSubscription(subscriptionData);
          if (upsertError) {
            console.error('❌ Error updating subscription on invoice paid:', upsertError);
          } else {
            console.log(`✅ Subscription renewed for user: ${subscription.user_id}`);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️  Unhandled webhook event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return res.json({ received: true });
  } catch (err) {
    console.error('❌ Webhook processing error:', err);
    return res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Auth-protected routes
app.use('/api', authMiddleware);
app.use('/api/resume', resumeRouter);
app.use('/api/scrape', scrapeRouter);
app.use('/api/subscription', subscriptionRouter);

const port = Number(process.env.PORT || 4000);

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`❌ Port ${port} is already in use.`);
    // eslint-disable-next-line no-console
    console.error(`💡 Try: kill -9 $(lsof -ti :${port})`);
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});


