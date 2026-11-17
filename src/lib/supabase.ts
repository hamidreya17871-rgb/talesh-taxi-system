import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

/**
 * Missing public build configuration must never crash module initialization.
 * The UI checks this flag and renders a clear setup screen before using the
 * fallback client. The fallback is deliberately non-functional and contains
 * no credential.
 */
export const isSupabaseConfigured =
  isValidSupabaseUrl(supabaseUrl) && Boolean(supabaseAnonKey);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://configuration-missing.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'configuration-missing-anon-key',
);
