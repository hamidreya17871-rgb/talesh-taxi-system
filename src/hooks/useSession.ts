import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';
import { isSupabaseConfigured } from '@/lib/supabase';

export type SessionStatus = 'loading' | 'signed-out' | 'ready' | 'pending' | 'rejected' | 'inactive' | 'error';

export function useSession() {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const readyUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('error');
      return;
    }
    let active = true;

    async function applySession(session: Session | null) {
      if (!active) return;
      if (!session) {
        readyUserIdRef.current = null;
        setProfile(null);
        setStatus('signed-out');
        return;
      }
      const userId = session.user.id;
      if (readyUserIdRef.current === userId) return;

      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      if (!active) return;
      if (error) {
        setStatus('error');
        return;
      }
      if (!data) {
        readyUserIdRef.current = null;
        setProfile(null);
        setStatus('inactive');
        return;
      }
      if (data.approval_status === 'rejected') {
        readyUserIdRef.current = null;
        setProfile(null);
        setStatus('rejected');
        return;
      }
      if (data.approval_status !== 'approved') {
        readyUserIdRef.current = null;
        setProfile(null);
        setStatus('pending');
        return;
      }
      if (!data.is_active) {
        readyUserIdRef.current = null;
        setProfile(null);
        setStatus('inactive');
        return;
      }
      readyUserIdRef.current = userId;
      setProfile(data as Profile);
      setStatus('ready');
    }

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { status, profile, signOut };
}
