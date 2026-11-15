import type { NavItem, PageKey } from '@/lib/fleetConfig';

type MobileNavProps = {
  items: NavItem[];
  keys: PageKey[];
  page: PageKey;
  onNavigate: (page: PageKey) => void;
};

export default function MobileNav({ items, keys, page, onNavigate }: MobileNavProps) {
  const visible = items.filter(item => keys.includes(item.key));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[3] hidden justify-around border-t border-ink-200 bg-white px-1 pb-[calc(7px_+_env(safe-area-inset-bottom))] pt-[7px] max-[650px]:flex"
      aria-label="منوی پایین"
    >
      {visible.map(({ key, label, icon: Icon }) => {
        const active = page === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={active ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-[5px] text-[10px] transition duration-200 ${
              active ? 'font-bold text-brand-600' : 'text-ink-600'
            }`}
          >
            <Icon size={19} />
            <span className="max-w-full truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
