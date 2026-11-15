import { statusTone, type StatusTone } from '@/lib/format';
import type { RecordValue } from '@/lib/fleetConfig';

const toneClasses: Record<StatusTone, string> = {
  ok: 'bg-brand-50 text-brand-600',
  warn: 'bg-gold-100 text-gold-700',
  bad: 'bg-error-100 text-error-500',
};

export default function StatusBadge({ status }: { status: RecordValue }) {
  return (
    <span className={`inline-block rounded-full px-[9px] py-[5px] text-[11px] ${toneClasses[statusTone(status)]}`}>
      {status || '—'}
    </span>
  );
}
