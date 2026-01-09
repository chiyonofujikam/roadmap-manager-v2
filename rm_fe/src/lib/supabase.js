import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

// Log if running in mock mode
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase environment variables not configured. Running in mock mode.');
  console.log('ℹ️ To use real Supabase, create a .env file with:');
  console.log('   VITE_SUPABASE_URL=your_url');
  console.log('   VITE_SUPABASE_ANON_KEY=your_key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
