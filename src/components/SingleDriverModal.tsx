import { useState, type FormEvent } from 'react';
import { UserPlus, X } from 'lucide-react';
import { callStaffApi } from '@/lib/staffApi';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import PlateInput from '@/components/PlateInput';

type Activation = { name: string; phone: string; activation_code: string; expires_at: string };
type Props = { onClose: () => void; onCreated: (activation: Activation) => void; onNotify: (message: string, kind?: 'success' | 'error') => void };

export default function SingleDriverModal({ onClose, onCreated, onNotify }: Props) {
  const [name, setName] = useState('');
  const [nationalCode, setNationalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [row, setRow] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mobile = normalizePhone(phone);
    const national = normalizePhone(nationalCode);
    if (!isValidPhone(mobile)) return setError('شماره موبایل معتبر نیست.');
    if (!/^\d{10}$/.test(national)) return setError('کد ملی باید ۱۰ رقم باشد.');
    setBusy(true);
    setError(null);
    try {
      const result = await callStaffApi<Activation>('create-driver-single', {
        full_name: name.trim(), national_code: national, phone: mobile, plate, model: model.trim(), taxi_row_no: normalizePhone(row),
      });
      onNotify('پرونده راننده و حساب کاربری در انتظار تأیید ایجاد شد.');
      onCreated(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت راننده انجام نشد.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4" onClick={() => !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="single-driver-title" className="panel max-h-[92vh] w-full max-w-xl overflow-y-auto" onClick={event => event.stopPropagation()}>
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="single-driver-title" className="text-lg font-bold">افزودن تکی راننده</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن"><X size={16}/></button>
        </header>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ink-600 sm:col-span-2">نام و نام خانوادگی
            <input required maxLength={100} className="field-input" value={name} onChange={e => setName(e.target.value)}/>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">کد ملی
            <input required inputMode="numeric" maxLength={10} dir="ltr" className="field-input" value={nationalCode} onChange={e => setNationalCode(e.target.value)}/>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">شماره موبایل
            <input required inputMode="tel" dir="ltr" className="field-input" value={phone} onChange={e => setPhone(e.target.value)}/>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600 sm:col-span-2">شماره پلاک
            <PlateInput id="single-driver-plate" value={plate} onChange={setPlate} required/>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">نوع / مدل خودرو
            <input required maxLength={100} className="field-input" value={model} onChange={e => setModel(e.target.value)}/>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">ردیف تاکسی
            <input required maxLength={20} className="field-input" value={row} onChange={e => setRow(e.target.value)}/>
          </label>
          <p className="text-xs leading-6 text-ink-500 sm:col-span-2">پس از ثبت، یک کد فعال‌سازی یک‌بارمصرف نمایش داده می‌شود. حساب راننده تا زمان بررسی و تأیید سازمان فعال نخواهد شد.</p>
          {error && <p className="text-sm text-error-500 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn" disabled={busy}><UserPlus size={16}/>{busy ? 'در حال ثبت…' : 'ثبت راننده'}</button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>انصراف</button>
          </div>
        </form>
      </section>
    </div>
  );
}
