import { useState } from 'react';
import { CheckCircle2, FileCheck2, FileUp, Send, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LetterRecord } from '@/components/LetterFormModal';
import type { Profile } from '@/lib/staff';

type Props = {
  letter: LetterRecord;
  profile: Profile;
  onSaved: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export default function OutgoingLetterWorkflowActions({ letter, profile, onSaved, onNotify }: Props) {
  const [orderNote, setOrderNote] = useState('');
  const [sentMethod, setSentMethod] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (letter.direction !== 'outgoing' || profile.role === 'driver') return null;

  async function update(expectedStatus: string, payload: Record<string, unknown>, success: string): Promise<boolean> {
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
      return false;
    }
    onNotify(success);
    onSaved();
    return true;
  }

  function validateReceipt(file: File): string | null {
    if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) return 'فقط فایل PDF، JPG یا PNG قابل بارگذاری است.';
    if (file.size > MAX_RECEIPT_BYTES) return 'حجم رسید نباید بیشتر از ۱۰ مگابایت باشد.';
    return null;
  }

  async function uploadReceipt(): Promise<string | null> {
    if (!receiptFile) return null;
    const validationError = validateReceipt(receiptFile);
    if (validationError) {
      setError(validationError);
      return null;
    }
    const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `letters/${letter.id}/delivery-receipt-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('archive-documents')
      .upload(path, receiptFile, { contentType: receiptFile.type, upsert: false });
    if (uploadError) {
      setError('بارگذاری رسید انجام نشد. دسترسی و اتصال را بررسی کنید.');
      return null;
    }
    return path;
  }

  async function dispatchLetter() {
    setBusy(true);
    setError(null);
    const uploadedPath = await uploadReceipt();
    if (receiptFile && !uploadedPath) {
      setBusy(false);
      return;
    }
    const ok = await update('امضا شده', {
      status: 'صادر شده',
      sent_at: new Date().toISOString(),
      sent_method: sentMethod.trim(),
      ...(uploadedPath ? { delivery_receipt_path: uploadedPath } : {}),
    }, 'صدور و روش ارسال نامه ثبت شد');
    setBusy(false);
    if (!ok && uploadedPath) {
      await supabase.storage.from('archive-documents').remove([uploadedPath]);
    }
  }

  async function attachReceiptToIssuedLetter() {
    setBusy(true);
    setError(null);
    const uploadedPath = await uploadReceipt();
    if (!uploadedPath) {
      setBusy(false);
      return;
    }
    const ok = await update('صادر شده', { delivery_receipt_path: uploadedPath }, 'رسید تحویل به پرونده نامه پیوست شد');
    setBusy(false);
    if (!ok) {
      await supabase.storage.from('archive-documents').remove([uploadedPath]);
    } else {
      setReceiptFile(null);
    }
  }

  async function openReceipt() {
    if (!letter.delivery_receipt_path) return;
    const { data, error: signedUrlError } = await supabase.storage
      .from('archive-documents')
      .createSignedUrl(letter.delivery_receipt_path, 60);
    if (signedUrlError || !data?.signedUrl) {
      setError('دریافت پیوند امن رسید ممکن نشد.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  const canExpertReview =
    profile.role === 'expert' &&
    ['ثبت شده', 'در حال بررسی', 'در انتظار بررسی کارشناس'].includes(letter.status);
  const canManagerSign = profile.role === 'manager' && letter.status === 'در انتظار تأیید مدیر';
  const canDispatch = profile.role === 'manager' && letter.status === 'امضا شده';
  const canClose = profile.role === 'manager' && letter.status === 'صادر شده';
  const canAttachReceipt = profile.role === 'manager' && letter.status === 'صادر شده' && !letter.delivery_receipt_path;

  if (!canExpertReview && !canManagerSign && !canDispatch && !canClose && !canAttachReceipt && !letter.delivery_receipt_path) return null;

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 flex flex-col gap-3">
      <p className="text-xs font-bold text-ink-700">گردش تأیید نامه صادره</p>

      {canExpertReview && (
        <button
          type="button"
          className="btn btn-secondary self-start"
          disabled={busy}
          onClick={() => void update(letter.status, {
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
            رسید ارسال (اختیاری، PDF/JPG/PNG تا ۱۰ مگابایت)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={event => setReceiptFile(event.target.files?.[0] ?? null)}
              className="field-input"
            />
          </label>
          <button
            type="button"
            className="btn self-start"
            disabled={busy || !sentMethod.trim()}
            onClick={() => void dispatchLetter()}
          >
            <Send size={15} />
            ثبت صدور و ارسال نامه
          </button>
        </>
      )}

      {canAttachReceipt && (
        <>
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            بارگذاری رسید تحویل پس از ارسال (PDF/JPG/PNG تا ۱۰ مگابایت)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={event => setReceiptFile(event.target.files?.[0] ?? null)}
              className="field-input"
            />
          </label>
          <button type="button" className="btn btn-secondary self-start" disabled={busy || !receiptFile} onClick={() => void attachReceiptToIssuedLetter()}>
            <FileUp size={15} />
            پیوست رسید به نامه صادرشده
          </button>
        </>
      )}

      {letter.delivery_receipt_path && (
        <button type="button" className="btn btn-secondary self-start" disabled={busy} onClick={() => void openReceipt()}>
          <Eye size={15} />
          مشاهده رسید تحویل
        </button>
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
