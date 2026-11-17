import { useState, type FormEvent } from 'react';
import { ArrowRight, Send, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isValidPhone, normalizePhone } from '@/lib/phone';

type Props = { onBack: () => void };

export default function CitizenViolationReportForm({ onBack }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [violationType, setViolationType] = useState('رفتار نامناسب راننده');
  const [taxiIdentifier, setTaxiIdentifier] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (website) return;
    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      setError('شماره موبایل باید به شکل ۰۹۱۲۳۴۵۶۷۸۹ باشد.');
      return;
    }
    if (!consent) {
      setError('برای ثبت گزارش، با ثبت و بررسی مشخصات تماس موافقت کنید.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from('citizen_violation_reports').insert({
      full_name: fullName.trim(),
      phone: normalizedPhone,
      violation_type: violationType,
      taxi_identifier: taxiIdentifier.trim() || null,
      location: location.trim(),
      description: description.trim(),
    });
    setBusy(false);
    if (insertError) {
      setError('ثبت گزارش انجام نشد. لطفاً چند دقیقه دیگر دوباره تلاش کنید.');
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShieldAlert size={26} /></span>
        <h2 className="font-bold">گزارش شما ثبت شد</h2>
        <p className="text-sm leading-7 text-ink-600">گزارش برای بررسی به واحد تاکسیرانی ارسال شد. مشخصات و شماره تماس شما فقط برای پیگیری و رسیدگی اداری در اختیار کارکنان مجاز قرار می‌گیرد.</p>
        <button type="button" className="btn" onClick={onBack}>بازگشت به ورود</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">گزارش تخلف شهروندی</h2>
        <button type="button" className="btn-tiny" onClick={onBack}><ArrowRight size={14} /> بازگشت</button>
      </div>
      <p className="text-xs leading-6 text-ink-600">بدون ساخت حساب کاربری گزارش خود را ثبت کنید. برای پیگیری، نام و شماره موبایل معتبر الزامی است.</p>
      <label className="flex flex-col gap-1 text-xs text-ink-600">نام و نام خانوادگی
        <input required minLength={2} maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} className="field-input" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-600">شماره موبایل
        <input required type="tel" inputMode="tel" dir="ltr" placeholder="09xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} className="field-input" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-600">نوع تخلف
        <select value={violationType} onChange={e => setViolationType(e.target.value)} className="field-input">
          <option>رفتار نامناسب راننده</option>
          <option>دریافت کرایه غیرمجاز</option>
          <option>عدم رعایت مقررات و مسیر</option>
          <option>وضعیت نامناسب خودرو</option>
          <option>سوار نکردن مسافر</option>
          <option>سایر موارد</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-600">شماره تاکسی یا مشخصات خودرو (در صورت اطلاع)
        <input maxLength={80} value={taxiIdentifier} onChange={e => setTaxiIdentifier(e.target.value)} className="field-input" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-600">محل و زمان تقریبی وقوع
        <input required minLength={3} maxLength={240} value={location} onChange={e => setLocation(e.target.value)} className="field-input" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-600">شرح گزارش
        <textarea required minLength={10} maxLength={3000} rows={4} value={description} onChange={e => setDescription(e.target.value)} className="field-input" />
      </label>
      <label className="hidden" aria-hidden="true">وب‌سایت
        <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
      </label>
      <label className="flex items-start gap-2 text-xs leading-6 text-ink-600">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
        با ثبت این فرم موافقم نام و شماره موبایلم برای بررسی و پیگیری این گزارش توسط کارکنان مجاز تاکسیرانی تالش نگهداری و استفاده شود.
      </label>
      {error && <p className="text-sm text-error-500">{error}</p>}
      <button type="submit" className="btn" disabled={busy}>
        <Send size={16} /> {busy ? 'در حال ثبت…' : 'ثبت گزارش'}
      </button>
      <p className="text-[11px] leading-5 text-ink-600">از ثبت اطلاعات نادرست یا گزارش‌های تکراری خودداری کنید. ثبت گزارش به‌معنای اثبات تخلف نیست و موضوع پس از بررسی کارشناسی تعیین تکلیف می‌شود.</p>
    </form>
  );
}
