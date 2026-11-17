import { useEffect, useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callStaffApi } from '@/lib/staffApi';
import { isValidPhone, normalizePhone, phoneToAccountEmail } from '@/lib/phone';
import DriverRegisterForm from '@/components/DriverRegisterForm';
import DriverActivateForm from '@/components/DriverActivateForm';
import StaffRegisterForm from '@/components/StaffRegisterForm';
import CitizenViolationReportForm from '@/components/CitizenViolationReportForm';

const LOGIN_ERROR = 'ورود ناموفق بود. شماره موبایل یا رمز عبور را بررسی کنید.';
const PHONE_ERROR = 'شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹';

type Mode = 'checking' | 'login' | 'register' | 'activate-driver' | 'staff-register' | 'setup' | 'citizen-report';

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
        : mode === 'activate-driver'
          ? 'فعال‌سازی حساب راننده'
          : mode === 'staff-register'
          ? 'ثبت‌نام کارشناس'
          : mode === 'citizen-report'
            ? 'ثبت گزارش شهروندی بدون ثبت‌نام'
            : 'ورود به سامانه';

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_#dcefe7_0%,_transparent_42%),radial-gradient(ellipse_at_bottom_left,_#f7ecd6_0%,_transparent_38%),#f3f6f5] p-5">
      <div className="relative z-10 w-full max-w-[440px] rounded-[26px] border border-white/80 bg-white/95 p-7 shadow-[0_24px_70px_#123b3518] backdrop-blur animate-pop-in max-[650px]:rounded-2xl max-[650px]:p-5">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <img src="/talesh-taxi-logo.svg" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/file_00000000b04481f4b5dfa592b07ecabc.png"; }} alt="نشان رسمی سازمان حمل‌ونقل و تاکسیرانی تالش" className="h-24 w-24 rounded-2xl object-contain shadow-lg shadow-brand-800/15" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-brand-900">سامانه تاکسیرانی تالش</h1>
            <p className="mt-2 text-sm text-ink-600">{subtitle}</p>
          </div>
        </div>

        {mode === 'checking' && <p className="py-8 text-center text-ink-600">در حال بررسی…</p>}

        {mode === 'register' && <DriverRegisterForm onBack={() => switchMode('login')} />}
        {mode === 'activate-driver' && <DriverActivateForm onBack={() => switchMode('login')} />}
        {mode === 'staff-register' && <StaffRegisterForm onBack={() => switchMode('login')} />}
        {mode === 'citizen-report' && <CitizenViolationReportForm onBack={() => switchMode('login')} />}

        {(mode === 'login' || mode === 'setup') && (
          <form onSubmit={mode === 'setup' ? handleSetup : handleLogin} className="flex flex-col gap-4">
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
            {mode === 'login' && <p className="text-center text-xs leading-6 text-ink-600">اگر رمز عبور را فراموش کرده‌اید، مدیر سازمان می‌تواند از بخش کاربران برایتان رمز تازه تنظیم کند.</p>}
            {mode === 'login' && (
              <button type="button" className="text-sm text-brand-700 underline-offset-4 hover:underline" onClick={() => switchMode('register')}>
                راننده هستید؟ ثبت‌نام کنید
              </button>
            )}
            {mode === 'login' && (
              <button type="button" className="text-sm text-brand-700 underline-offset-4 hover:underline" onClick={() => switchMode('activate-driver')}>
                اطلاعاتتان با اکسل ثبت شده؟ فعال‌سازی و تعیین رمز
              </button>
            )}
            {mode === 'login' && (
              <button type="button" className="text-sm font-bold text-brand-700 underline-offset-4 hover:underline" onClick={() => switchMode('citizen-report')}>
                شهروند هستید؟ گزارش تخلف ثبت کنید
              </button>
            )}
            {mode === 'login' && (
              <button type="button" className="text-sm text-brand-700 underline-offset-4 hover:underline" onClick={() => switchMode('staff-register')}>
                کارشناس هستید؟ ثبت‌نام کنید
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
