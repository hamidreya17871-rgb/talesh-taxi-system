import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { OBJECTION_ACCEPTED, OBJECTION_REJECTED } from '@/lib/reviews';
import { formatPersianDate } from '@/lib/format';
import type { FleetRecord, RecordValue } from '@/lib/fleetConfig';

type Props = {
  violation: FleetRecord;
  onDecide: (decision: string) => Promise<boolean>;
  onClose: () => void;
};

export default function ObjectionReviewModal({ violation, onDecide, onClose }: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  async function decide(decision: string) {
    setBusy(true);
    const saved = await onDecide(decision);
    if (!saved) setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[5] flex items-center justify-center bg-[#0b2824a6] p-[18px] animate-fade-in"
      onClick={event => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="objection-review-title"
        className="max-h-[90vh] w-full max-w-[480px] animate-pop-in overflow-auto rounded-[18px] bg-white p-6 shadow-[0_20px_70px_#0003]"
      >
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div>
            <h3 id="objection-review-title" className="text-lg font-bold">
              بررسی اعتراض
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              {displayValue(violation.driver_name)} · {displayValue(violation.kind)} · {formatDate(violation.recorded_on)}
            </p>
          </div>
          <StatusBadge status={violation.objection_decision} />
        </div>
        <div className="mb-[18px] rounded-[12px] bg-ink-50 p-3">
          <p className="mb-2 text-xs text-ink-600">
            متن اعتراض ({formatDate(String(violation.objection_submitted_at ?? '').slice(0, 10))})
          </p>
          <p className="whitespace-pre-line text-sm text-ink-800">{displayValue(violation.objection_text)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={busy} onClick={() => void decide(OBJECTION_ACCEPTED)}>
            <CheckCircle2 size={16} />
            پذیرش اعتراض
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void decide(OBJECTION_REJECTED)}>
            <XCircle size={16} />
            رد اعتراض
          </button>
        </div>
      </div>
    </div>
  );
}

function displayValue(value: RecordValue | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function formatDate(value: RecordValue | undefined): string {
  return typeof value === 'string' && value ? formatPersianDate(value) : '—';
}
