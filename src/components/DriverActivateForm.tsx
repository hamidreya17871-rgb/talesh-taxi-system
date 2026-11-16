import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callStaffApi } from '@/lib/staffApi';
import { isValidPhone, normalizePhone, phoneToAccountEmail } from '@/lib/phone';

type Props = { onBack: () => void };

export default function DriverActivateForm({ onBack }: Props) {
  const [phone, setPhone] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      setError('شماره موبایل معتبر نیست.');
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError('رمز عبور باید بین ۸ تا ۷۲ نویسه باشد.');
      return;
    }
    if (password !== confirmPassword) {
      setError('تکرار رمز عبور با رمز اصلی یکسان نیست.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callStaffApi('activate-imported-driver', {
        phone: normalizedPhone,
        activation_code: activationCode.trim(),
        password,
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneToAccountEmail(normalizedPhone),
        password,
      });
      if (signInError) {
        setError('رمز شما ثبت شد. اکنون از صفحه ورود با شماره موبایل و رمز جدید وارد شوید.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'فعال‌سازی انجام نشد.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[13px]">
      <p className="text-xs leading-[1.7] text-ink-600">
        این بخش مخصوص راننده‌هایی است که اطلاعاتشان با فایل گروهی وارد شده است.
        کد فعال‌سازی را از واحد تاکسیرانی دریافت کنید.
      </p>
      <label className="flex flex-col gap-[7px] text-xs text-ink-600">
        شماره موبایل ثبت‌شده
        <input required type="tel" inputMode="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} className="field-input" />
      </label>
      <label className="flex flex-col gap-[7px] text-xs text-ink-600">
        کد فعال‌سازی
        <input required dir="ltr" autoComplete="one-time-code" value={activationCode} onChange={e => setActivationCode(e.target.value)} className="field-input" />
      </label>
      <label className="flex flex-col gap-[7px] text-xs text-ink-600">
        رمز عبور جدید (حداقل ۸ نویسه)
        <input required minLength={8} maxLength={72} type="password" dir="ltr" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="field-input" />
      </label>
      <label className="flex flex-col gap-[7px] text-xs text-ink-600">
        تکرار رمز عبور
        <input required minLength={8} maxLength={72} type="password" dir="ltr" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="field-input" />
      </label>
      {error && <p className="text-sm text-error-500">{error}</p>}
      <button type="submit" className="btn mt-2" disabled={busy}>
        <KeyRound size={16} />
        {busy ? 'لطفاً صبر کنید…' : 'فعال‌سازی و تعیین رمز'}
      </button>
      <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy}>
        <ArrowRight size={16} />
        بازگشت به ورود
      </button>
    </form>
  );
}
