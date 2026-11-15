import { useEffect, useState, type FormEvent } from 'react';
import { CarTaxiFront, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callStaffApi } from '@/lib/staffApi';
import { isValidPhone, normalizePhone, phoneToAccountEmail } from '@/lib/phone';
import DriverRegisterForm from '@/components/DriverRegisterForm';
import StaffRegisterForm from '@/components/StaffRegisterForm';

const LOGIN_ERROR = 'ورود ناموفق بود. شماره موبایل یا رمز عبور را بررسی کنید.';
const PHONE_ERROR = 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹';

type Mode = 'checking' | 'login' | 'register' | 'staff-register' | 'setup';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('checking');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    callStaffApi<{ needsSetup: boolean }>('needs-setup')
      .then(result => {
        if (active) setMode(result.needsSetup ? 'setup' : 'login');
      })
      .catch(() => {
        if (active) setMode('login');
      });
    return () => {
      active = false;
    };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      setError(PHONE_ERROR);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: phoneToAccountEmail(normalizedPhone),
      password,
    });
    if (signInError) setError(LOGIN_ERROR);
    setBusy(false);
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      setError(PHONE_ERROR);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callStaffApi('bootstrap', {
        full_name: fullName,
        phone: normalizedPhone,
        password,
        registration_code: registrationCode.trim(),
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneToAccountEmail(normalizedPhone),
        password,
      });
      if (signInError) setError(LOGIN_ERROR);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'عملیات انجام نشد.');
    }
    setBusy(false);
  }

  const subtitle =
    mode === 'setup'
      ? 'راه‌اندازی اولیه: ایجاد حساب مدیر سازمان'
      : mode === 'register'
        ? 'ثبت‌نام راننده'
        : mode === 'staff-register'
          ? 'ثبت‌نام مدیر و کارشناس'
          : 'ورود به سامانه';

  return (
    <div className="grid min-h-screen place-items-center p-[18px]">
      <div className="panel w-full max-w-[420px] p-7 animate-pop-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold-400 text-brand-800">
            <CarTaxiFront size={28} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-lg font-bold">تاکسیرانی تالش</h1>
            <p className="mt-1 text-xs text-ink-600">{subtitle}</p>
          </div>
        </div>

        {mode === 'checking' && <p className="py-8 text-center text-ink-600">در حال بررسی…</p>}

        {mode === 'register' && <DriverRegisterForm onBack={() => switchMode('login')} />}
        {mode === 'staff-register' && <StaffRegisterForm onBack={() => switchMode('login')} />}

        {(mode === 'login' || mode === 'setup') && (
          <form onSubmit={mode === 'setup' ? handleSetup : handleLogin} className="flex flex-col gap-[13px]">
            {mode === 'setup' && (
              <>
                <div className="flex flex-col gap-[7px]">
                  <label htmlFor="setup-name" className="text-xs text-ink-600">نام و نام خانوادگی</label>
                  <input id="setup-name" required value={fullName} onChange={e => setFullName(e.target.value)} className="field-input" />
                </div>
                <div className="flex flex-col gap-[7px]">
                  <label htmlFor="setup-registration-code" className="text-xs text-ink-600">شناسه راه‌اندازی سازمان</label>
                  <input id="setup-registration-code" type="password" required autoComplete="off" dir="ltr" value={registrationCode} onChange={e => setRegistrationCode(e.target.value)} className="field-input" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="login-phone" className="text-xs text-ink-600">شماره موبایل</label>
              <input
                id="login-phone"
                type="tel"
                inputMode="tel"
                required
                dir="ltr"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="field-input"
              />
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="login-password" className="text-xs text-ink-600">
                رمز عبور{mode === 'setup' ? ' (حداقل ۸ نویسه)' : ''}
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={mode === 'setup' ? 8 : undefined}
                dir="ltr"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="field-input"
              />
            </div>
            {error && <p className="text-sm text-error-500">{error}</p>}
            <button type="submit" className="btn mt-2" disabled={busy}>
              <LogIn size={16} />
              {busy ? 'لطفاً صبر کنید…' : mode === 'setup' ? 'ایجاد حساب و ورود' : 'ورود'}
            </button>
            {mode === 'login' && (
              <button type="button" className="text-sm text-brand-700 underline-offset-4 hover:underline" onClick={() => switchMode('register')}>
                راننده هستید؟ ثبت‌نام کنید
              </button>
            )}
            {mode === 'login' && (
              <button type="button" className="text-sm text-brand-700 underline-offset-4 hover:underline" onClick={() => switchMode('staff-register')}>
                مدیر یا کارشناس هستید؟ ثبت‌نام کنید
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
