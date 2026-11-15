import { CarTaxiFront } from 'lucide-react';
import type { NavItem, PageKey } from '@/lib/fleetConfig';

type SidebarProps = {
  items: NavItem[];
  page: PageKey;
  onNavigate: (page: PageKey) => void;
};

export default function Sidebar({ items, page, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-[250px] shrink-0 flex-col bg-brand-800 px-3.5 py-[22px] text-brand-50 max-[1000px]:w-[220px] max-[650px]:hidden">
      <div className="flex items-center gap-3 border-b border-white/15 px-2 pb-6 pt-1">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400 text-brand-800">
          <CarTaxiFront size={24} strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-sm font-bold leading-[1.9] text-white">تاکسیرانی تالش</p>
          <p className="text-xs text-brand-200">سامانه مدیریت حمل‌ونقل</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 pt-[18px]" aria-label="منوی اصلی">
        {items.map(({ key, label, icon: Icon }) => {
          const active = page === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-[11px] px-[13px] py-3 text-right transition duration-200 ${
                active ? 'bg-white/10 font-bold text-white' : 'text-brand-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
