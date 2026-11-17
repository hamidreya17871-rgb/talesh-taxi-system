import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const GENERIC_ERROR = 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.';

export async function callStaffApi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('تنظیمات اتصال سامانه کامل نیست.');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-staff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...body }),
  });

  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
        ? result.error
        : GENERIC_ERROR;
    throw new Error(message);
  }
  if (typeof result !== 'object' || result === null) throw new Error(GENERIC_ERROR);
  return result as T;
}
