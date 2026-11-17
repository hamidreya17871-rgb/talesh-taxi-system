import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

export type SessionStatus = 'loading' | 'signed-out' | 'ready' | 'pending' | 'rejected' | 'inactive' | 'error';

function withTimeout<T>(promise: PromiseLike<T>, milliseconds = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('Session request timed out')),
      milliseconds,
    );
    Promise.resolve(promise).then(
      value => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      error => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function useSession() {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const readyUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setStatus('error');
      return () => { active = false; };
    }

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

      try {
        const { data, error } = await withTimeout(
          supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        );
        if (!active) return;
        if (error) throw error;
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
      } catch {
        if (active) setStatus('error');
      }
    }

    void withTimeout(supabase.auth.getSession())
      .then(({ data }) => applySession(data.session))
      .catch(() => {
        if (active) setStatus('error');
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }, []);

  return { status, profile, signOut };
}
