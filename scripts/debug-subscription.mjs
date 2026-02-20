#!/usr/bin/env node
/**
 * Debug subscription for a user: sign in with Supabase, then call subscription/status and usage.
 * Usage: node scripts/debug-subscription.mjs <email> <password>
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (from .env or export)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2] || 'datigo5205@iaciu.com';
const password = process.argv[3] || 'Aa38844511@';
const API_BASE = process.env.DEBUG_API_BASE || 'https://api.hex0x.com:4000';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Signing in as', email, '...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error('Auth error:', authError.message);
    process.exit(1);
  }
  const token = authData.session?.access_token;
  if (!token) {
    console.error('No access token in response');
    process.exit(1);
  }
  console.log('Got token (first 30 chars):', token.substring(0, 30) + '...');
  console.log('User id:', authData.user?.id);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log('\n--- GET /api/subscription/status ---');
  const statusRes = await fetch(`${API_BASE}/api/subscription/status`, { headers });
  const statusText = await statusRes.text();
  console.log('Status HTTP:', statusRes.status);
  try {
    console.log('Body:', JSON.stringify(JSON.parse(statusText), null, 2));
  } catch {
    console.log('Body (raw):', statusText);
  }

  console.log('\n--- GET /api/subscription/usage ---');
  const usageRes = await fetch(`${API_BASE}/api/subscription/usage`, { headers });
  const usageText = await usageRes.text();
  console.log('Status HTTP:', usageRes.status);
  try {
    console.log('Body:', JSON.stringify(JSON.parse(usageText), null, 2));
  } catch {
    console.log('Body (raw):', usageText);
  }

  const doRecover = process.argv.includes('--recover');
  if (doRecover) {
    console.log('\n--- POST /api/subscription/recover ---');
    const recoverRes = await fetch(`${API_BASE}/api/subscription/recover`, { method: 'POST', headers });
    const recoverText = await recoverRes.text();
    console.log('Status HTTP:', recoverRes.status);
    try {
      console.log('Body:', JSON.stringify(JSON.parse(recoverText), null, 2));
    } catch {
      console.log('Body (raw):', recoverText);
    }
    if (recoverRes.ok) {
      console.log('\n--- GET /api/subscription/status (after recover) ---');
      const status2Res = await fetch(`${API_BASE}/api/subscription/status`, { headers });
      const status2Text = await status2Res.text();
      console.log('Status HTTP:', status2Res.status);
      try {
        console.log('Body:', JSON.stringify(JSON.parse(status2Text), null, 2));
      } catch {
        console.log('Body (raw):', status2Text);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
