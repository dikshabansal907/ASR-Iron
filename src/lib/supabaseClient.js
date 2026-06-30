import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Supports both Supabase dashboard naming styles.
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase key exists:', Boolean(supabaseKey));

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL. Check .env.local in project root.');
}

if (!supabaseKey) {
  throw new Error('Missing Supabase key. Add VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
