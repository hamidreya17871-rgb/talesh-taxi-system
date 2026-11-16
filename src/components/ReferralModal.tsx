import { useState, type FormEvent } from 'react';
import { Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LetterRecord } from '@/components/LetterFormModal';

type StaffOption = { user_id: string; full_name: string };

type Props = {
  letter: LetterRecord;
  staff: StaffOption[];
  currentUserId: string;
  onSaved: () => void;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const GENERIC_ERROR = 'ارجاع انجام نشد. لطفاً دوباره تلاش کنید.';

export default function ReferralModal({ letter, staff, currentUserId, onSaved, onClose, onNotify }: Props) {
  const [referredTo, setReferredTo] = useState('');
  const [action, setAction] = useState<'review' | 'follow-up' | 'signature'>('review');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = staff.filter(s => s.user_id !== currentUserId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!referredTo) {
      setError('گیرنده ارجاع را انتخاب کنید.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: referralError } = await supabase.rpc('create_letter_referral', {
      p_letter_id: letter.id,
      p_referred_to: referredTo,
      p_action: action,
      p_note: note.trim() || null,
    });
    if (referralError) {
      setError(referralError.message?.includes('امضا شده') ? 'این نامه امضا شده و امکان ارجاع مجدد ندارد.' : GENERIC_ERROR);
      setBusy(false);
      return;
    }
    onNotify('نامه ارجاع شد');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-[18px]" onClick={() => !busy && onClose()}>
      <div className="panel w-full max-w-[420px] animate-pop-in" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">ارجاع نامه</h2>
            <p className="mt-1 text-xs text-ink-600">نامه شماره {letter.letter_no} — {letter.subject}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="referral-to" className="text-xs text-ink-600">ارجاع به</label>
            <select id="referral-to" value={referredTo} onChange={e => setReferredTo(e.target.value)} className="field-input">
              <option value="">انتخاب کنید…</option>
              {eligible.map(s => (
                <option key={s.user_id} value={s.user_id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="referral-action" className="text-xs text-ink-600">نوع اقدام</label>
            <select id="referral-action" value={action} onChange={e => setAction(e.target.value as 'review' | 'follow-up' | 'signature')} className="field-input">
              <option value="review">بررسی</option>
              <option value="follow-up">پیگیری</option>
              <option value="signature">امضا</option>
            </select>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="referral-note" className="text-xs text-ink-600">توضیح (اختیاری)</label>
            <textarea id="referral-note" rows={3} value={note} onChange={e => setNote(e.target.value)} className="field-input" />
          </div>

          {error && <p className="text-sm text-error-500">{error}</p>}
          <button type="submit" className="btn mt-2" disabled={busy}>
            <Send size={16} />
            {busy ? 'لطفاً صبر کنید…' : 'ارجاع نامه'}
          </button>
        </form>
      </div>
    </div>
  );
}
