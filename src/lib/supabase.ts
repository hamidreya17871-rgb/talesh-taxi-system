import { createClient } from '@supabase/supabase-js';

// Supabase publishable keys are designed for browser clients. RLS and server-side
// authorization remain the security boundary; never place a service-role key here.
const DEFAULT_SUPABASE_URL = 'https://xrhzsafezpwdztjytkob.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_FNHTbG5T_N3EA3tYDpM3DA_QlONmgXW';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export const isSupabaseConfigured =
  isValidSupabaseUrl(supabaseUrl) && Boolean(supabaseKey);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://configuration-missing.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'configuration-missing-anon-key',
);
