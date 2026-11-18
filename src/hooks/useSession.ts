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
    let authEventSeen = false;
    let currentUserId: string | null = null;
    let loadingUserId: string | null = null;
    let requestVersion = 0;

    if (!isSupabaseConfigured) {
      setStatus('error');
      return () => { active = false; };
    }

    async function applySession(session: Session | null) {
      if (!active) return;

      if (!session) {
        requestVersion += 1;
        currentUserId = null;
        loadingUserId = null;
        readyUserIdRef.current = null;
        setProfile(null);
        setStatus('signed-out');
        return;
      }

      const userId = session.user.id;
      currentUserId = userId;
      if (readyUserIdRef.current === userId) return;
      if (loadingUserId === userId) return;

      const version = ++requestVersion;
      loadingUserId = userId;
      readyUserIdRef.current = null;
      setProfile(null);
      setStatus('loading');

      try {
        const { data, error } = await withTimeout(
          supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        );
        if (!active || version !== requestVersion || currentUserId !== userId) return;
        if (error) throw error;

        if (!data) {
          setProfile(null);
          setStatus('inactive');
        } else if (data.approval_status === 'rejected') {
          setProfile(null);
          setStatus('rejected');
        } else if (data.approval_status !== 'approved') {
          setProfile(null);
          setStatus('pending');
        } else if (!data.is_active) {
          setProfile(null);
          setStatus('inactive');
        } else {
          readyUserIdRef.current = userId;
          setProfile(data as Profile);
          setStatus('ready');
        }
      } catch {
        if (active && version === requestVersion && currentUserId === userId) {
          readyUserIdRef.current = null;
          setProfile(null);
          setStatus('error');
        }
      } finally {
        if (version === requestVersion && loadingUserId === userId) {
          loadingUserId = null;
        }
      }
    }

    // Subscribe first so a slow getSession() cannot overwrite a newer auth event.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      // Supabase invokes auth listeners while holding its internal auth lock.
      // Defer profile I/O until after this synchronous callback has returned.
      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    void withTimeout(supabase.auth.getSession())
      .then(({ data }) => {
        if (active && !authEventSeen) void applySession(data.session);
      })
      .catch(() => {
        if (active && !authEventSeen) setStatus('error');
      });

    return () => {
      active = false;
      requestVersion += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }, []);

  return { status, profile, signOut };
}
