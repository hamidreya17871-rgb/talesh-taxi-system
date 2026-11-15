import { useState } from 'react';
import { Flag } from 'lucide-react';
import ObjectionModal from '@/components/ObjectionModal';
import StatusBadge from '@/components/StatusBadge';
import type { FleetRecord, RecordValue } from '@/lib/fleetConfig';
import { formatNumber, formatPersianDate } from '@/lib/format';

type Props = {
  violations: FleetRecord[];
  onSubmitted: () => void;
};

export default function DriverViolationsPage({ violations, onSubmitted }: Props) {
  const [objecting, setObjecting] = useState<FleetRecord | null>(null);

  return (
    <section className="flex flex-col gap-[22px]">
      <div>
        <h2 className="mb-2 text-[22px] font-bold max-[650px]:text-lg">تخلفات من</h2>
        <p className="text-ink-600 max-[650px]:text-xs">مشاهده آرای تخلف و ثبت اعتراض برای هر رأی</p>
      </div>

      {violations.length === 0 && <div className="panel text-center text-ink-600">تخلفی برای شما ثبت نشده است</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {violations.map(record => {
          const submitted = typeof record.objection_submitted_at === 'string' && record.objection_submitted_at !== '';
          return (
            <article key={record.id} className="panel flex flex-col gap-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{displayValue(record.kind)}</h3>
                  <p className="mt-1 text-xs text-ink-600">پلاک: {displayValue(record.plate)}</p>
                </div>
                <StatusBadge status={record.status} />
              </div>
              <div className="flex flex-col gap-1 text-sm text-ink-600">
                <p>تاریخ: {formatDate(record.recorded_on)}</p>
                <p>مبلغ جریمه: {record.amount ? `${formatNumber(record.amount)} تومان` : '—'}</p>
                {displayValue(record.notes) !== '—' && <p>شرح: {displayValue(record.notes)}</p>}
              </div>

              {submitted ? (
                <div className="rounded-[12px] bg-ink-50 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Flag size={14} />
                      اعتراض ثبت‌شده
                    </span>
                    <StatusBadge status={record.objection_decision} />
                  </div>
                  <p className="whitespace-pre-line text-ink-700">{displayValue(record.objection_text)}</p>
                  <p className="mt-2 text-xs text-ink-600">ثبت: {formatDate(String(record.objection_submitted_at ?? '').slice(0, 10))}</p>
                </div>
              ) : (
                <button type="button" className="btn btn-secondary self-start" onClick={() => setObjecting(record)}>
                  <Flag size={16} />
                  اعتراض به رأی
                </button>
              )}
            </article>
          );
        })}
      </div>

      {objecting && (
        <ObjectionModal
          violation={objecting}
          onClose={() => setObjecting(null)}
          onSubmitted={() => {
            setObjecting(null);
            onSubmitted();
          }}
        />
      )}
    </section>
  );
}

function displayValue(value: RecordValue | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function formatDate(value: RecordValue | undefined): string {
  return typeof value === 'string' && value ? formatPersianDate(value) : '—';
}
