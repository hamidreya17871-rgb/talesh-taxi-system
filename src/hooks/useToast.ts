import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastState = { id: number; message: string; tone: 'success' | 'error' };

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: ToastState['tone'] = 'success') => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setToast({ id: Date.now(), message, tone });
    timerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast };
}
