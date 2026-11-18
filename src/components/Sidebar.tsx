import type { NavItem, PageKey } from '@/lib/fleetConfig';

type SidebarProps = {
  items: NavItem[];
  page: PageKey;
  onNavigate: (page: PageKey) => void;
};

export default function Sidebar({ items, page, onNavigate }: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-[252px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-brand-800 px-3.5 py-6 shadow-[4px_0_24px_#0c2a2510] text-brand-50 max-[1000px]:w-[224px] max-[650px]:hidden">
      <div className="flex items-center gap-3 border-b border-white/15 px-2 pb-6 pt-1">
        <img src="/talesh-taxi-logo.webp" alt="نشان تاکسیرانی تالش" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-0.5" />
        <div>
          <p className="text-sm font-bold leading-[1.9] text-white">سازمان تاکسیرانی تالش</p>
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition duration-200 ${
                active ? 'border-r-[3px] border-gold-400 bg-white/10 font-bold text-white shadow-inner' : 'border-r-[3px] border-transparent text-brand-100 hover:bg-white/10 hover:text-white'
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
