import { useState } from 'react';
import { CheckCircle2, FileCheck2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LetterRecord } from '@/components/LetterFormModal';
import type { Profile } from '@/lib/staff';

type Props = {
  letter: LetterRecord;
  profile: Profile;
  onSaved: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

export default function OutgoingLetterWorkflowActions({ letter, profile, onSaved, onNotify }: Props) {
  const [orderNote, setOrderNote] = useState('');
  const [sentMethod, setSentMethod] = useState('');
  const [receiptPath, setReceiptPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (letter.direction !== 'outgoing' || profile.role === 'driver') return null;

  async function update(expectedStatus: string, payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('letters')
      .update(payload)
      .eq('id', letter.id)
      .eq('status', expectedStatus)
      .select('id')
      .maybeSingle();
    setBusy(false);
    if (updateError || !data) {
      setError('وضعیت نامه تغییر کرده یا مجوز انجام عملیات را ندارید؛ فهرست را به‌روزرسانی کنید.');
      return;
    }
    onNotify(success);
    onSaved();
  }

  const canExpertReview =
    profile.role === 'expert' &&
    ['ثبت شده', 'در حال بررسی', 'در انتظار بررسی کارشناس'].includes(letter.status);
  const canManagerSign = profile.role === 'manager' && letter.status === 'در انتظار تأیید مدیر';
  const canDispatch = profile.role === 'manager' && letter.status === 'امضا شده';
  const canClose = profile.role === 'manager' && letter.status === 'صادر شده';

  if (!canExpertReview && !canManagerSign && !canDispatch && !canClose) return null;

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 flex flex-col gap-3">
      <p className="text-xs font-bold text-ink-700">گردش تأیید نامه صادره</p>

      {canExpertReview && (
        <button
          type="button"
          className="btn btn-secondary self-start"
          disabled={busy}
          onClick={() => void update('' + letter.status, {
            status: 'در انتظار تأیید مدیر',
            expert_reviewed_by: profile.user_id,
            expert_reviewed_at: new Date().toISOString(),
          }, 'بررسی کارشناس ثبت و برای تأیید مدیر ارسال شد')}
        >
          <FileCheck2 size={15} />
          ثبت بررسی کارشناس و ارسال به مدیر
        </button>
      )}

      {canManagerSign && (
        <>
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            دستور و توضیح مدیر (الزامی)
            <textarea
              rows={3}
              maxLength={3000}
              value={orderNote}
              onChange={event => setOrderNote(event.target.value)}
              className="field-input"
              placeholder="دستور مدیر برای تأیید و امضای نامه"
            />
          </label>
          <button
            type="button"
            className="btn self-start"
            disabled={busy || !orderNote.trim()}
            onClick={() => void update('در انتظار تأیید مدیر', {
              status: 'امضا شده',
              manager_signed_by: profile.user_id,
              manager_signed_at: new Date().toISOString(),
              manager_order_note: orderNote.trim(),
            }, 'تأیید و امضای داخلی مدیر ثبت شد')}
          >
            <CheckCircle2 size={15} />
            تأیید و امضای مدیر
          </button>
        </>
      )}

      {canDispatch && (
        <>
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            روش ارسال (الزامی)
            <input
              value={sentMethod}
              maxLength={120}
              onChange={event => setSentMethod(event.target.value)}
              className="field-input"
              placeholder="مثلاً پست، پیک، تحویل حضوری"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            مسیر فایل رسید تحویل (اختیاری)
            <input
              value={receiptPath}
              onChange={event => setReceiptPath(event.target.value)}
              className="field-input"
              placeholder="مسیر فایل در بایگانی"
            />
          </label>
          <button
            type="button"
            className="btn self-start"
            disabled={busy || !sentMethod.trim()}
            onClick={() => void update('امضا شده', {
              status: 'صادر شده',
              sent_at: new Date().toISOString(),
              sent_method: sentMethod.trim(),
              delivery_receipt_path: receiptPath.trim() || null,
            }, 'صدور و روش ارسال نامه ثبت شد')}
          >
            <Send size={15} />
            ثبت صدور و ارسال نامه
          </button>
        </>
      )}

      {canClose && (
        <button
          type="button"
          className="btn btn-secondary self-start"
          disabled={busy}
          onClick={() => void update('صادر شده', { status: 'مختومه' }, 'پرونده نامه مختومه شد')}
        >
          <CheckCircle2 size={15} />
          مختومه‌سازی نامه
        </button>
      )}

      {error && <p className="text-xs text-error-500">{error}</p>}
    </div>
  );
}
