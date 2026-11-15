import { useEffect, useState, type FormEvent } from 'react';
import { Save, X } from 'lucide-react';
import { callStaffApi } from '@/lib/staffApi';
import { supabase } from '@/lib/supabase';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { ROLE_LABELS, ROLE_OPTIONS, type Profile, type StaffRole } from '@/lib/staff';

type DriverOption = { id: string; name: string | null };

type Props = {
  user: Profile | null;
  drivers: DriverOption[];
  onSaved: () => void;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const GENERIC_ERROR = 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.';

export default function UserFormModal({ user, drivers, onSaved, onClose, onNotify }: Props) {
  const isEdit = user !== null;
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>(user?.role ?? 'expert');
  const [driverId, setDriverId] = useState(user?.driver_id ?? '');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [isLineInspector, setIsLineInspector] = useState(user?.is_line_inspector ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [busy, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === 'driver' && !driverId) {
      setError('برای نقش راننده، پرونده راننده را انتخاب کنید.');
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!isEdit && !isValidPhone(normalizedPhone)) {
      setError('شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹');
      return;
    }

    setBusy(true);
    setError(null);
    const linkedDriverId = role === 'driver' ? driverId : null;
    try {
      if (user) {
        await callStaffApi('update', {
          user_id: user.user_id,
          full_name: fullName,
          role,
          driver_id: linkedDriverId,
          is_active: isActive,
          ...(password ? { password } : {}),
        });
        const { error: inspectorError } = await supabase.from('profiles')
          .update({ is_line_inspector: role === 'driver' && isLineInspector })
          .eq('user_id', user.user_id);
        if (inspectorError) throw new Error('تغییر نقش بازرس خط ذخیره نشد.');
      } else {
        await callStaffApi('create', {
          full_name: fullName,
          phone: normalizedPhone,
          password,
          role,
          driver_id: linkedDriverId,
        });
      }
      onNotify(isEdit ? 'اطلاعات کاربر ذخیره شد' : 'کاربر جدید ساخته شد');
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : GENERIC_ERROR);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-[18px]" onClick={() => !busy && onClose()}>
      <div className="panel w-full max-w-[460px] animate-pop-in" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'ویرایش کاربر' : 'افزودن کاربر'}</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="user-name" className="text-xs text-ink-600">نام و نام خانوادگی</label>
            <input id="user-name" required value={fullName} onChange={e => setFullName(e.target.value)} className="field-input" />
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="user-phone" className="text-xs text-ink-600">شماره موبایل</label>
              <input id="user-phone" type="tel" inputMode="tel" required dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} className="field-input" />
            </div>
          )}

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="user-password" className="text-xs text-ink-600">
              {isEdit ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور (حداقل ۸ نویسه)'}
            </label>
            <input
              id="user-password"
              type="password"
              required={!isEdit}
              minLength={isEdit ? undefined : 8}
              dir="ltr"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="field-input"
            />
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="user-role" className="text-xs text-ink-600">نقش</label>
            <select id="user-role" value={role} onChange={e => setRole(e.target.value as StaffRole)} className="field-input">
              {ROLE_OPTIONS.map(option => (
                <option key={option} value={option}>{ROLE_LABELS[option]}</option>
              ))}
            </select>
          </div>

          {role === 'driver' && (
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="user-driver" className="text-xs text-ink-600">پرونده راننده</label>
              <select id="user-driver" value={driverId} onChange={e => setDriverId(e.target.value)} className="field-input">
                <option value="">انتخاب کنید</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>{driver.name ?? 'بدون نام'}</option>
                ))}
              </select>
            </div>
          )}

          {isEdit && role === 'driver' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isLineInspector} onChange={e => setIsLineInspector(e.target.checked)} />
              بازرس خط (هم‌زمان با حفظ نقش رانندگی)
            </label>
          )}

          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              حساب فعال باشد
            </label>
          )}

          {error && <p className="text-sm text-error-500">{error}</p>}

          <button type="submit" className="btn mt-2" disabled={busy}>
            <Save size={16} />
            {busy ? 'لطفاً صبر کنید…' : 'ذخیره'}
          </button>
        </form>
      </div>
    </div>
  );
}
