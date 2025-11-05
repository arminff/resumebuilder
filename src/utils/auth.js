import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env not configured. Auth middleware will fail until set.');
}

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function getUserFromToken(accessToken) {
  if (!supabase) {
    console.error('❌ Supabase not configured - check SUPABASE_URL and SUPABASE_ANON_KEY in .env');
    return { user: null, error: new Error('Supabase not configured') };
  }
  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error) {
      console.error('❌ Supabase auth error:', error.message);
      return { user: null, error };
    }
    if (!data?.user) {
      console.error('❌ No user data returned from Supabase');
      return { user: null, error: new Error('No user data') };
    }
    console.log('✅ Authentication successful for user:', data.user.email);
    return { user: data.user, error: null };
  } catch (err) {
    console.error('❌ Auth exception:', err.message);
    return { user: null, error: err };
  }
}

export async function authMiddleware(req, res, next) {
  if (req.path === '/health') return next();
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  
  if (!token) {
    console.error('❌ Missing Authorization header');
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  console.log('🔍 Validating token... (first 20 chars:', token.substring(0, 20) + '...)');
  const { user, error } = await getUserFromToken(token);
  
  if (error || !user) {
    const errorMsg = error?.message || 'Invalid or expired token';
    console.error('❌ Auth failed:', errorMsg);
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
  
  req.user = user;
  return next();
}


