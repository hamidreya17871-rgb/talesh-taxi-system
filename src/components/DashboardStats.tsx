import { Bell, BadgeCheck, Car, CalendarDays, Flag, FolderOpen, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import type { DashboardStat } from '@/lib/fleetStats';
import { formatNumber } from '@/lib/format';

const ICONS: Record<DashboardStat['icon'], LucideIcon> = {
  users: Users,
  car: Car,
  file: BadgeCheck,
  alert: TriangleAlert,
  calendar: CalendarDays,
  shield: Flag,
  bell: Bell,
  folder: FolderOpen,
};

const TONE_CLASSES: Record<DashboardStat['tone'], string> = {
  brand: 'bg-brand-50 text-brand-600',
  gold: 'bg-gold-100 text-gold-700',
  blue: 'bg-blue-50 text-blue-600',
  error: 'bg-error-100 text-error-500',
  neutral: 'bg-ink-100 text-ink-600',
};

export default function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="mb-[22px] grid grid-cols-4 gap-[15px] max-[1000px]:grid-cols-3 max-[650px]:grid-cols-2 max-[650px]:gap-[9px]">
      {stats.map(stat => {
        const Icon = ICONS[stat.icon];
        return (
          <div
            key={stat.key}
            className="panel flex min-h-[112px] items-start justify-between gap-3 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_12px_30px_#163c3218] max-[650px]:min-h-[96px] max-[650px]:gap-2 max-[650px]:p-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium leading-6 text-ink-600 max-[650px]:text-xs">{stat.label}</p>
              <p className="mt-1 text-[26px] font-extrabold leading-tight tabular-nums max-[650px]:text-[22px]">{formatNumber(stat.value)}</p>
            </div>
            <div className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl max-[650px]:h-9 max-[650px]:w-9 ${TONE_CLASSES[stat.tone]}`}>
              <Icon size={20} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
