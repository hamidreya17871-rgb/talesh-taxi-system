import { useEffect, useState, type FormEvent } from 'react';
import { Printer, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPersianDate, todayIso } from '@/lib/format';
import { printLetter } from '@/lib/letterhead';
import LetterAttachments, { uploadLetterAttachments } from '@/components/LetterAttachments';
import JalaliDateInput from '@/components/JalaliDateInput';

export type LetterPriority = 'normal' | 'urgent' | 'immediate';

export const LETTER_PRIORITY_LABELS: Record<LetterPriority, string> = {
  normal: 'عادی',
  urgent: 'فوری',
  immediate: 'آنی',
};

export type LetterRecord = {
  id: string;
  letter_no: number;
  direction: 'incoming' | 'outgoing';
  subject: string;
  body: string;
  correspondent: string | null;
  letter_date: string | null;
  attachment_path: string | null;
  status: string;
  priority?: LetterPriority;
  response_due_at?: string | null;
  expert_reviewed_by?: string | null;
  expert_reviewed_at?: string | null;
  manager_signed_by?: string | null;
  manager_signed_at?: string | null;
  manager_order_note?: string | null;
  sent_at?: string | null;
  sent_method?: string | null;
  delivery_receipt_path?: string | null;
  created_at: string;
};

type Props = {
  letter: LetterRecord | null;
  onSaved: () => void;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const GENERIC_ERROR = 'ذخیره نامه انجام نشد. لطفاً دوباره تلاش کنید.';

export default function LetterFormModal({ letter, onSaved, onClose, onNotify }: Props) {
  const isEdit = !!letter;
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>(letter?.direction ?? 'outgoing');
  const [subject, setSubject] = useState(letter?.subject ?? '');
  const [body, setBody] = useState(letter?.body ?? '');
  const [correspondent, setCorrespondent] = useState(letter?.correspondent ?? '');
  const [letterDate, setLetterDate] = useState(letter?.letter_date ?? todayIso());
  const [letterNo, setLetterNo] = useState(letter ? String(letter.letter_no) : '');
  const [attachment, setAttachment] = useState(letter?.attachment_path ?? '');
  const [savedLetterId, setSavedLetterId] = useState<string | null>(letter?.id ?? null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [attachmentType, setAttachmentType] = useState('attachment');
  const [priority, setPriority] = useState<LetterPriority>(letter?.priority ?? 'normal');
  const [priorityDays, setPriorityDays] = useState<Record<LetterPriority, number>>({ normal: 5, urgent: 2, immediate: 1 });
  const isLocked = Boolean(letter?.direction === 'outgoing' && (letter.manager_signed_at || ['امضا شده', 'صادر شده', 'در انتظار پاسخ', 'مختومه'].includes(letter.status)));
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (letter) {
      setDirection(letter.direction);
      setSubject(letter.subject);
      setBody(letter.body);
      setCorrespondent(letter.correspondent ?? '');
      setLetterDate(letter.letter_date ?? todayIso());
      setLetterNo(String(letter.letter_no));
      setAttachment(letter.attachment_path ?? '');
      setSavedLetterId(letter.id);
      setPendingAttachments([]);
      setAttachmentType('attachment');
      setPriority(letter.priority ?? 'normal');
    }
  }, [letter]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: settingsError } = await supabase
        .from('letter_priority_settings')
        .select('priority, working_days');
      if (!active || settingsError || !data) return;
      setPriorityDays(current => {
        const next = { ...current };
        for (const row of data as { priority: LetterPriority; working_days: number }[]) {
          if (row.priority in next && Number.isInteger(row.working_days) && row.working_days >= 1 && row.working_days <= 30) {
            next[row.priority] = row.working_days;
          }
        }
        return next;
      });
    })();
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim()) {
      setError('موضوع نامه را وارد کنید.');
      return;
    }
    const trimmedNo = letterNo.trim();
    const normalizedNo = trimmedNo
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const numberValue = trimmedNo === '' ? null : Number(normalizedNo);
    if (numberValue !== null && (!Number.isInteger(numberValue) || numberValue <= 0)) {
      setError('شماره نامه باید عدد صحیح مثبت باشد.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      ...(numberValue !== null ? { letter_no: numberValue } : {}),
      direction,
      subject: subject.trim(),
      body: body.trim(),
      correspondent: correspondent.trim() || null,
      letter_date: letterDate || null,
      attachment_path: attachment.trim() || null,
      priority,
    };
    let saveError: { code?: string } | null = null;
    let targetLetterId = savedLetterId;
    if (targetLetterId) {
      const result = await supabase.from('letters').update(payload).eq('id', targetLetterId);
      saveError = result.error;
    } else {
      const result = await supabase.from('letters').insert(payload).select('id').single();
      saveError = result.error;
      targetLetterId = result.data?.id ?? null;
      if (targetLetterId) setSavedLetterId(targetLetterId);
    }
    if (saveError || !targetLetterId) {
      setError(saveError?.code === '23505' ? 'این شماره نامه قبلاً ثبت شده است.' : GENERIC_ERROR);
      setBusy(false);
      return;
    }

    if (pendingAttachments.length > 0) {
      const uploadResult = await uploadLetterAttachments(targetLetterId, pendingAttachments, attachmentType);
      setPendingAttachments(uploadResult.failedFiles);
      if (uploadResult.errors.length > 0) {
        setError(`نامه ذخیره شد؛ اما بارگذاری برخی پیوست‌ها ناموفق بود: ${uploadResult.errors.join(' ')}`);
        setBusy(false);
        return;
      }
    }
    onNotify(isEdit ? 'نامه ویرایش شد' : 'نامه ثبت شد');
    onSaved();
  }

  function handlePrint(includeLetterhead: boolean) {
    if (!letter) return;
    printLetter({
      letterNo: letter.letter_no,
      date: letter.letter_date ?? todayIso(),
      subject: letter.subject,
      body: letter.body,
      correspondent: letter.correspondent ?? undefined,
      attachment: letter.attachment_path,
      direction: letter.direction,
      includeLetterhead,
      paperSize,
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-[18px]" onClick={() => !busy && onClose()}>
      <div className="panel w-full max-w-[640px] max-h-[90vh] animate-pop-in overflow-y-auto" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'ویرایش نامه' : 'نامه جدید'}</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        {isLocked && <p className="mb-3 rounded-lg bg-gold-50 p-3 text-xs leading-6 text-gold-800">این نامه پس از تأیید مدیر قفل شده است؛ برای اصلاح، باید نسخه اصلاحی یا نامه پیرو ثبت شود.</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="letter-number" className="text-xs text-ink-600">شماره نامه</label>
              <input id="letter-number" type="text" inputMode="numeric" disabled={isLocked} value={letterNo} onChange={e => setLetterNo(e.target.value)} placeholder="خودکار" className="field-input" />
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="letter-attachment" className="text-xs text-ink-600">شرح پیوست (اختیاری)</label>
              <input id="letter-attachment" type="text" disabled={isLocked} value={attachment} onChange={e => setAttachment(e.target.value)} className="field-input" />
            </div>
          </div>

          <LetterAttachments
            letterId={savedLetterId}
            queuedFiles={pendingAttachments}
            onQueuedFilesChange={setPendingAttachments}
            canUpload={!isLocked}
            documentType={attachmentType}
            onDocumentTypeChange={setAttachmentType}
          />

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-direction" className="text-xs text-ink-600">نوع نامه</label>
            <select id="letter-direction" disabled={isEdit} value={direction} onChange={e => setDirection(e.target.value as 'incoming' | 'outgoing')} className="field-input">
              <option value="outgoing">نامه خروجی</option>
              <option value="incoming">نامه ورودی</option>
            </select>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-priority" className="text-xs text-ink-600">درجه فوریت و مهلت اقدام</label>
            <select id="letter-priority" disabled={isLocked} value={priority} onChange={e => setPriority(e.target.value as LetterPriority)} className="field-input">
              <option value="normal">{`عادی — ${priorityDays.normal} روز کاری`}</option>
              <option value="urgent">{`فوری — ${priorityDays.urgent} روز کاری`}</option>
              <option value="immediate">{`آنی — ${priorityDays.immediate} روز کاری`}</option>
            </select>
            <p className="text-[11px] text-ink-500">مهلت از زمان ارجاع به کارشناس محاسبه می‌شود؛ پنجشنبه، جمعه و تعطیلات ثبت‌شده در تقویم سازمان از روزهای کاری محاسبه نمی‌شوند.</p>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-paper-size" className="text-xs text-ink-600">اندازه کاغذ چاپ</label>
            <select id="letter-paper-size" value={paperSize} onChange={e => setPaperSize(e.target.value as 'A4' | 'A5')} className="field-input">
              <option value="A4">A4 — ۲۱۰ × ۲۹۷ میلی‌متر</option>
              <option value="A5">A5 — ۱۴۸ × ۲۱۰ میلی‌متر</option>
            </select>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-subject" className="text-xs text-ink-600">موضوع</label>
            <input id="letter-subject" type="text" required disabled={isLocked} value={subject} onChange={e => setSubject(e.target.value)} className="field-input" />
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-correspondent" className="text-xs text-ink-600">{direction === 'incoming' ? 'فرستنده' : 'گیرنده'}</label>
            <input id="letter-correspondent" type="text" disabled={isLocked} value={correspondent} onChange={e => setCorrespondent(e.target.value)} className="field-input" />
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-date" className="text-xs text-ink-600">تاریخ نامه</label>
            <div className={isLocked ? "pointer-events-none opacity-60" : ""}><JalaliDateInput id="letter-date" value={letterDate} onChange={setLetterDate} /></div>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-body" className="text-xs text-ink-600">متن نامه</label>
            <textarea id="letter-body" rows={8} disabled={isLocked} value={body} onChange={e => setBody(e.target.value)} className="field-input" />
          </div>

          {error && <p className="text-sm text-error-500">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn" disabled={busy || isLocked}>
              <Save size={16} />
              {busy ? 'لطفاً صبر کنید…' : 'ذخیره'}
            </button>
            {isEdit && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => handlePrint(true)}>
                  <Printer size={16} />
                  چاپ با سربرگ
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => handlePrint(false)}>
                  <Printer size={16} />
                  چاپ بدون سربرگ
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function letterDateText(letter: LetterRecord): string {
  return letter.letter_date ? formatPersianDate(letter.letter_date) : formatPersianDate(letter.created_at);
}
