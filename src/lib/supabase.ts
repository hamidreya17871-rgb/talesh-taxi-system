import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Keep the app renderable when a Cloudflare Preview environment is missing
// its Supabase variables. App.tsx displays a clear configuration message.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://missing-preview-config.supabase.co',
  supabaseAnonKey || 'missing-preview-anon-key'
);
