import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const email = 'arminfn2004@gmail.com';
const password = 'Aa38844511@';

console.log('🔐 Signing in to Supabase...');

try {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }

  if (data?.session?.access_token) {
    console.log('\n✅ Authentication successful!');
    console.log('\n📋 Your access token:');
    console.log('─'.repeat(80));
    console.log(data.session.access_token);
    console.log('─'.repeat(80));
    console.log('\n💡 Token expires at:', new Date(data.session.expires_at * 1000).toISOString());
    console.log('\n💾 Copy this token and use it in your API requests!');
  } else {
    console.error('❌ No access token received');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}