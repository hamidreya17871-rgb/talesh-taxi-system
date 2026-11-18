import { useState, type FormEvent } from 'react';
import { UserX, X } from 'lucide-react';

export type DriverEndReason = 'vehicle_sold' | 'retired' | 'ceased_activity';

type Props = {
  driverName: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (reason: DriverEndReason, note: string) => void;
};

export default function DriverLifecycleModal({ driverName, busy = false, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<DriverEndReason>('vehicle_sold');
  const [note, setNote] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(reason, note.trim());
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4" onClick={() => !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="driver-lifecycle-title" className="panel w-full max-w-lg" onClick={event => event.stopPropagation()}>
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="driver-lifecycle-title" className="text-lg font-bold">پایان فعالیت راننده</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن"><X size={16}/></button>
        </header>
        <p className="mb-4 text-sm text-ink-600">پرونده «{driverName}» حذف نمی‌شود؛ فقط دسترسی ورود او قطع و سابقه‌اش حفظ می‌شود.</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            علت خاتمه فعالیت
            <select className="field-input" value={reason} onChange={event => setReason(event.target.value as DriverEndReason)}>
              <option value="vehicle_sold">فروش خودرو</option>
              <option value="retired">بازنشستگی</option>
              <option value="ceased_activity">قطع همکاری / توقف فعالیت</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            توضیحات و شماره/تاریخ نامه (اختیاری)
            <textarea className="field-input min-h-24" maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="جزئیات لازم برای سابقه پرونده را وارد کنید."/>
          </label>
          {reason === 'vehicle_sold' && (
            <p className="rounded-lg bg-ink-50 p-3 text-xs leading-6 text-ink-600">
              این عملیات حساب راننده را غیرفعال می‌کند و سابقه را نگه می‌دارد. انتقال مالکیت خودرو باید جداگانه در پرونده خودرو و بایگانی انتقال مالکیت ثبت شود.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn" disabled={busy}><UserX size={16}/>{busy ? 'در حال ثبت…' : 'ثبت پایان فعالیت'}</button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>انصراف</button>
          </div>
        </form>
      </section>
    </div>
  );
}
