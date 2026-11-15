import { useState, type FormEvent } from 'react';
import { ArrowRight, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callStaffApi } from '@/lib/staffApi';
import { isValidPhone, normalizePhone, phoneToAccountEmail } from '@/lib/phone';
import PlateInput from '@/components/PlateInput';
import Field from '@/components/FormField';

type Props = {
  onBack: () => void;
};

export default function DriverRegisterForm({ onBack }: Props) {
  const [fullName, setFullName] = useState('');
  const [nationalCode, setNationalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [taxiRowNo, setTaxiRowNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    const normalizedNationalCode = normalizePhone(nationalCode);
    if (!isValidPhone(normalizedPhone)) {
      setError('شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹');
      return;
    }
    if (!/^\d{10}$/.test(normalizedNationalCode)) {
      setError('کد ملی باید ۱۰ رقم باشد.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await callStaffApi('register-driver', {
        full_name: fullName,
        national_code: normalizedNationalCode,
        phone: normalizedPhone,
        password,
        plate,
        model,
        taxi_row_no: taxiRowNo,
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
        اطلاعات زیر را وارد کنید. پس از بررسی و تأیید مدیر یا کارشناس، حساب شما فعال می‌شود.
      </p>
      <Field id="reg-name" label="نام و نام خانوادگی" value={fullName} onChange={setFullName} required />
      <Field id="reg-national" label="کد ملی" value={nationalCode} onChange={setNationalCode} required inputMode="numeric" ltr />
      <Field id="reg-phone" label="شماره موبایل" value={phone} onChange={setPhone} required inputMode="tel" ltr />
      <Field
        id="reg-password"
        label="رمز عبور (حداقل ۸ نویسه)"
        value={password}
        onChange={setPassword}
        required
        type="password"
        minLength={8}
        ltr
      />
      <div className="flex flex-col gap-[7px]">
        <span className="text-xs text-ink-600">شماره پلاک خودرو</span>
        <PlateInput id="reg-plate" value={plate} onChange={setPlate} required />
      </div>
      <Field id="reg-model" label="نوع / مدل خودرو" value={model} onChange={setModel} required />
      <Field id="reg-taxi-row" label="ردیف تاکسی" value={taxiRowNo} onChange={setTaxiRowNo} required />
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
