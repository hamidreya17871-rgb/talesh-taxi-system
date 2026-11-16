import { useState, type FormEvent } from 'react';
import { ArrowRight, UserPlus } from 'lucide-react';
import Field from '@/components/FormField';
import { supabase } from '@/lib/supabase';
import { callStaffApi } from '@/lib/staffApi';
import { isValidPhone, normalizePhone, phoneToAccountEmail } from '@/lib/phone';

type Props = {
  onBack: () => void;
};

const STAFF_ROLE_OPTIONS = [{ value: 'expert', label: 'کارشناس' }] as const;

export default function StaffRegisterForm({ onBack }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<(typeof STAFF_ROLE_OPTIONS)[number]['value']>('expert');
  const [registrationCode, setRegistrationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      setError('شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await callStaffApi('register-staff', {
        full_name: fullName,
        phone: normalizedPhone,
        password,
        role,
        registration_code: registrationCode.trim(),
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneToAccountEmail(normalizedPhone),
        password,
      });
      if (signInError) setError('ثبت‌نام انجام شد، اما ورود خودکار ناموفق بود. با رمز عبور خود وارد شوید.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'عملیات انجام نشد.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
      <p className="text-xs leading-[1.5] text-ink-600">
        برای ثبت‌نام کارشناس، شناسه ثبت‌نام سازمان را وارد کنید.
      </p>
      <Field id="staff-name" label="نام و نام خانوادگی" value={fullName} onChange={setFullName} required />
      <Field id="staff-phone" label="شماره موبایل" value={phone} onChange={setPhone} required inputMode="tel" ltr />
      <Field
        id="staff-password"
        label="رمز عبور (حداقل ۸ نویسه)"
        value={password}
        onChange={setPassword}
        required
        type="password"
        minLength={8}
        ltr
      />
      <div className="flex flex-col gap-[7px]">
        <label htmlFor="staff-role" className="text-xs text-ink-600">
          نقش
        </label>
        <select id="staff-role" value={role} onChange={event => setRole(event.target.value as typeof role)} className="field-input">
          {STAFF_ROLE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <Field id="staff-code" label="شناسه ثبت‌نام" value={registrationCode} onChange={setRegistrationCode} required ltr />
      {error && <p className="text-sm text-error-500">{error}</p>}
      <button type="submit" className="btn mt-2" disabled={busy}>
        <UserPlus size={16} />
        {busy ? 'لطفاً صبر کنید…' : 'ثبت‌نام'}
      </button>
      <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy}>
        <ArrowRight size={16} />
        بازگشت به ورود
      </button>
    </form>
  );
}
