import { useEffect, useState, type FormEvent } from 'react';
import { Printer, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPersianDate, todayIso } from '@/lib/format';
import { printLetter } from '@/lib/letterhead';
import JalaliDateInput from '@/components/JalaliDateInput';

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
    }
  }, [letter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim()) {
      setError('موضوع نامه را وارد کنید.');
      return;
    }
    const trimmedNo = letterNo.trim();
    const numberValue = trimmedNo === '' ? null : Number(trimmedNo);
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
    };
    const { error: saveError } = isEdit
      ? await supabase.from('letters').update(payload).eq('id', letter!.id)
      : await supabase.from('letters').insert(payload);
    if (saveError) {
      setError(saveError.code === '23505' ? 'این شماره نامه قبلاً ثبت شده است.' : GENERIC_ERROR);
      setBusy(false);
      return;
    }
    onNotify(isEdit ? 'نامه ویرایش شد' : 'نامه ثبت شد');
    onSaved();
  }

  function handlePrint() {
    if (!letter) return;
    printLetter({
      letterNo: letter.letter_no,
      date: letter.letter_date ?? todayIso(),
      subject: letter.subject,
      body: letter.body,
      correspondent: letter.correspondent ?? undefined,
      attachment: letter.attachment_path,
      direction: letter.direction,
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="letter-number" className="text-xs text-ink-600">شماره نامه</label>
              <input
                id="letter-number"
                type="text"
                inputMode="numeric"
                value={letterNo}
                onChange={e => setLetterNo(e.target.value)}
                placeholder="خودکار"
                className="field-input"
              />
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="letter-attachment" className="text-xs text-ink-600">پیوست</label>
              <input id="letter-attachment" type="text" value={attachment} onChange={e => setAttachment(e.target.value)} className="field-input" />
            </div>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-direction" className="text-xs text-ink-600">نوع نامه</label>
            <select id="letter-direction" value={direction} onChange={e => setDirection(e.target.value as 'incoming' | 'outgoing')} className="field-input">
              <option value="outgoing">نامه خروجی</option>
              <option value="incoming">نامه ورودی</option>
            </select>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-subject" className="text-xs text-ink-600">موضوع</label>
            <input id="letter-subject" type="text" required value={subject} onChange={e => setSubject(e.target.value)} className="field-input" />
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-correspondent" className="text-xs text-ink-600">
              {direction === 'incoming' ? 'فرستنده' : 'گیرنده'}
            </label>
            <input id="letter-correspondent" type="text" value={correspondent} onChange={e => setCorrespondent(e.target.value)} className="field-input" />
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-date" className="text-xs text-ink-600">تاریخ نامه</label>
            <JalaliDateInput id="letter-date" value={letterDate} onChange={setLetterDate} />
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="letter-body" className="text-xs text-ink-600">متن نامه</label>
            <textarea id="letter-body" rows={8} value={body} onChange={e => setBody(e.target.value)} className="field-input" />
          </div>

          {error && <p className="text-sm text-error-500">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn" disabled={busy}>
              <Save size={16} />
              {busy ? 'لطفاً صبر کنید…' : 'ذخیره'}
            </button>
            {isEdit && (
              <button type="button" className="btn btn-secondary" onClick={handlePrint}>
                <Printer size={16} />
                چاپ با سربرگ
              </button>
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
