import { useEffect, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { FleetRecord, RecordValue } from '@/lib/fleetConfig';
import { formatPersianDate } from '@/lib/format';
import { OBJECTION_MAX_LENGTH, OBJECTION_MIN_LENGTH } from '@/lib/reviews';
import { supabase } from '@/lib/supabase';

type Props = {
  violation: FleetRecord;
  onClose: () => void;
  onSubmitted: () => void;
};

const SUBMIT_ERROR = 'ثبت اعتراض انجام نشد. لطفاً دوباره تلاش کنید.';

export default function ObjectionModal({ violation, onClose, onSubmitted }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmedLength = text.trim().length;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmedLength < OBJECTION_MIN_LENGTH || trimmedLength > OBJECTION_MAX_LENGTH) {
      setError(`متن اعتراض باید بین ${OBJECTION_MIN_LENGTH} تا ${OBJECTION_MAX_LENGTH} نویسه باشد.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('submit_violation_objection', {
      p_violation_id: violation.id,
      p_text: text.trim(),
    });
    if (rpcError) {
      setError(SUBMIT_ERROR);
      setBusy(false);
      return;
    }
    onSubmitted();
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
        aria-labelledby="objection-title"
        className="max-h-[90vh] w-full max-w-[480px] animate-pop-in overflow-auto rounded-[18px] bg-white p-6 shadow-[0_20px_70px_#0003]"
      >
        <h3 id="objection-title" className="mb-2 text-lg font-bold">
          اعتراض به رأی تخلف
        </h3>
        <p className="mb-[18px] text-sm text-ink-600">
          تخلف {displayValue(violation.kind)} به تاریخ {formatDate(violation.recorded_on)}
        </p>
        <div className="mb-[18px] rounded-[12px] border border-gold-400 bg-gold-100 p-3 text-sm text-gold-700">
          هر تخلف فقط یک‌بار قابل اعتراض است. پس از ثبت، امکان ویرایش یا ارسال مجدد اعتراض وجود ندارد.
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="objection-text" className="text-xs text-ink-600">
              دلیل اعتراض
            </label>
            <textarea
              id="objection-text"
              value={text}
              onChange={event => setText(event.target.value)}
              rows={5}
              maxLength={OBJECTION_MAX_LENGTH}
              required
              className="field-input min-h-[120px] resize-y"
            />
            <span className="text-xs text-ink-600">
              {trimmedLength} از {OBJECTION_MAX_LENGTH} نویسه
            </span>
          </div>
          {error && <p className="text-sm text-error-500">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button type="submit" className="btn" disabled={busy}>
              <Send size={16} />
              {busy ? 'در حال ثبت…' : 'ثبت اعتراض'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              انصراف
            </button>
          </div>
        </form>
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
