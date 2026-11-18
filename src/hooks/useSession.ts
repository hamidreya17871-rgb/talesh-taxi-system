import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

export type SessionStatus = 'loading' | 'signed-out' | 'ready' | 'pending' | 'rejected' | 'inactive' | 'error';

function withTimeout<T>(promise: PromiseLike<T>, milliseconds = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(`Request timed out after ${milliseconds}ms`)),
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Unknown session error');
  }
  return String(error ?? 'Unknown session error');
}

export function useSession() {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const readyUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let authEventSeen = false;
    let currentUserId: string | null = null;
    let loadingUserId: string | null = null;
    let requestVersion = 0;

    setStatus('loading');
    setProfile(null);
    setSessionError(null);
    readyUserIdRef.current = null;

    if (!isSupabaseConfigured) {
      setStatus('error');
      setSessionError('تنظیمات اتصال به پایگاه داده کامل نیست.');
      console.error('[useSession] Supabase client is not configured');
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
      } catch (error) {
        console.error('[useSession] Failed to load the signed-in user profile', {
          userId,
          message: errorMessage(error),
          error,
        });
        if (active && version === requestVersion && currentUserId === userId) {
          readyUserIdRef.current = null;
          setProfile(null);
          setSessionError(errorMessage(error));
          setStatus('error');
        }
      } finally {
        if (version === requestVersion && loadingUserId === userId) {
          loadingUserId = null;
        }
      }
    }

    // Subscribe before reading the persisted session. Profile I/O is deferred
    // until after the auth callback returns, avoiding Supabase's auth lock.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    void withTimeout(supabase.auth.getSession())
      .then(({ data, error }) => {
        if (error) throw error;
        if (active && !authEventSeen) void applySession(data.session);
      })
      .catch(error => {
        console.error('[useSession] Failed to restore the persisted auth session', {
          message: errorMessage(error),
          error,
        });
        if (active && !authEventSeen) {
          setSessionError(errorMessage(error));
          setStatus('error');
        }
      });

    return () => {
      active = false;
      requestVersion += 1;
      listener.subscription.unsubscribe();
    };
  }, [retryVersion]);

  const retry = useCallback(() => {
    setSessionError(null);
    setStatus('loading');
    setRetryVersion(version => version + 1);
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[useSession] Sign out failed', error);
      throw error;
    }
  }, []);

  return { status, profile, signOut, retry, sessionError };
}
