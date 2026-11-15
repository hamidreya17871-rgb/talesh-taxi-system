import type { ToastState } from '@/hooks/useToast';

const toneClasses: Record<ToastState['tone'], string> = {
  success: 'bg-brand-800',
  error: 'bg-error-500',
};

export default function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 left-5 z-10 animate-toast-in rounded-[10px] px-[18px] py-3 text-sm font-bold text-white shadow-lg max-[650px]:bottom-[80px] ${toneClasses[toast.tone]}`}
    >
      {toast.message}
    </div>
  );
}
