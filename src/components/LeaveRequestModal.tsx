import { useState, type FormEvent } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LEAVE_TYPES, type LeaveRequest } from '@/lib/leave';
import JalaliDateInput from '@/components/JalaliDateInput';

type Props = {
  driverId: string;
  onSaved: () => void;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const GENERIC_ERROR = 'ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.';

export default function LeaveRequestModal({ driverId, onSaved, onClose, onNotify }: Props) {
  const [leaveType, setLeaveType] = useState<LeaveRequest['leave_type']>(LEAVE_TYPES[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [destinationProvince, setDestinationProvince] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (endDate < startDate) {
      setError('تاریخ پایان نباید قبل از تاریخ شروع باشد.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data: saved, error: insertError } = await supabase
      .from('leave_requests')
      .insert({
        driver_id: driverId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
        destination_province: destinationProvince.trim(),
        destination_city: destinationCity.trim(),
      })
      .select('status')
      .single();
    if (insertError || !saved) {
      setError(GENERIC_ERROR);
      setBusy(false);
      return;
    }
    onNotify(
      saved.status === 'approved'
        ? 'مرخصی شما بدون نیاز به تأیید سازمان ثبت شد. می‌توانید نامه را چاپ کنید.'
        : 'درخواست مرخصی ثبت شد و تا تأیید سازمان در انتظار می‌ماند.',
    );
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-[18px]" onClick={() => !busy && onClose()}>
      <div className="panel w-full max-w-[460px] animate-pop-in" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">درخواست مرخصی</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="leave-type" className="text-xs text-ink-600">نوع مرخصی</label>
            <select id="leave-type" value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveRequest['leave_type'])} className="field-input">
              {LEAVE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="leave-start" className="text-xs text-ink-600">از تاریخ</label>
              <JalaliDateInput id="leave-start" value={startDate} onChange={setStartDate} required />
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="leave-end" className="text-xs text-ink-600">تا تاریخ</label>
              <JalaliDateInput id="leave-end" value={endDate} onChange={setEndDate} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="leave-province" className="text-xs text-ink-600">استان مقصد</label>
              <input id="leave-province" type="text" required value={destinationProvince} onChange={e => setDestinationProvince(e.target.value)} className="field-input" />
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="leave-city" className="text-xs text-ink-600">شهر مقصد</label>
              <input id="leave-city" type="text" required value={destinationCity} onChange={e => setDestinationCity(e.target.value)} className="field-input" />
            </div>
          </div>
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="leave-reason" className="text-xs text-ink-600">توضیحات (اختیاری)</label>
            <textarea id="leave-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} className="field-input" />
          </div>
          {error && <p className="text-sm text-error-500">{error}</p>}
          <button type="submit" className="btn mt-2" disabled={busy}>
            <CalendarPlus size={16} />
            {busy ? 'لطفاً صبر کنید…' : 'ثبت درخواست'}
          </button>
        </form>
      </div>
    </div>
  );
}
