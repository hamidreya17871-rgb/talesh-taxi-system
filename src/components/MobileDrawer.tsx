import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { NavItem, PageKey } from '@/lib/fleetConfig';

type Props = {
  items: NavItem[];
  page: PageKey;
  open: boolean;
  onNavigate: (page: PageKey) => void;
  onClose: () => void;
};

export default function MobileDrawer({ items, page, open, onNavigate, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="بستن منو"
        className="absolute inset-0 bg-ink-900/45"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="منوی اصلی"
        dir="rtl"
        className="absolute right-0 top-0 flex h-full w-[min(86vw,340px)] flex-col overflow-y-auto bg-brand-800 px-4 py-5 text-brand-50 shadow-2xl animate-pop-in"
      >
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/talesh-taxi-logo.webp"
              alt="نشان سازمان تاکسیرانی تالش"
              className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm"
            />
            <div className="min-w-0">
              <p className="font-bold leading-6 text-white">سازمان تاکسیرانی تالش</p>
              <p className="mt-1 text-xs text-brand-200">منوی اصلی سامانه</p>
            </div>
          </div>
          <button type="button" className="shrink-0 rounded-lg p-2 hover:bg-white/10" onClick={onClose} aria-label="بستن منو">
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map(({ key, label, icon: Icon }) => {
            const active = page === key;
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  onNavigate(key);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition ${active ? 'bg-white/15 font-bold text-white' : 'text-brand-100 hover:bg-white/10'}`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
