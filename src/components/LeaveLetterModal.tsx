import { useEffect, useState } from 'react';
import { Printer, RotateCcw, X } from 'lucide-react';
import { buildDefaultLetterBody, printLeaveLetter } from '@/lib/leaveLetter';
import JalaliDateInput from '@/components/JalaliDateInput';
import type { LeaveRequest } from '@/lib/leave';
import { supabase } from '@/lib/supabase';

type Props = {
  request: LeaveRequest;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

type VehicleRow = { model: string | null; plate: string | null };

const VEHICLE_LOAD_ERROR = 'اطلاعات خودرو دریافت نشد. می‌توانید خودرو را دستی وارد کنید.';
const PRINT_BLOCKED = 'پنجره چاپ باز نشد. لطفاً اجازه باز شدن پنجره را بدهید.';
const DEFAULT_ORIGIN = 'تالش';

export default function LeaveLetterModal({ request, onClose, onNotify }: Props) {
  const [driverName, setDriverName] = useState(request.drivers?.name ?? '');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plate, setPlate] = useState('');
  const [startDate, setStartDate] = useState(request.start_date);
  const [endDate, setEndDate] = useState(request.end_date);
  const [days, setDays] = useState(request.days);
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [province, setProvince] = useState(request.destination_province ?? '');
  const [city, setCity] = useState(request.destination_city ?? '');
  const [attachment, setAttachment] = useState('');
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [reviewerSignature, setReviewerSignature] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('model, plate')
        .eq('driver_id', request.driver_id)
        .limit(1);
      if (!active) return;
      if (error || !Array.isArray(data)) {
        setVehicleError(VEHICLE_LOAD_ERROR);
        return;
      }
      const vehicle = (data as VehicleRow[])[0];
      if (vehicle) {
        setVehicleModel(vehicle.model ?? '');
        setPlate(vehicle.plate ?? '');
      }
    })();
    return () => {
      active = false;
    };
  }, [request.driver_id]);

  const defaultBody = buildDefaultLetterBody({
    driverName: driverName.trim() || '—',
    vehicleModel: vehicleModel.trim() || '—',
    plate: plate.trim() || '—',
    startDate,
    endDate,
    days,
    origin: origin.trim() || DEFAULT_ORIGIN,
    destinationProvince: province.trim() || '—',
    destinationCity: city.trim() || '—',
  });
  const body = customBody ?? defaultBody;

  function handlePrint(includeLetterhead: boolean) {
    if (!printLeaveLetter(request.letter_no, body, includeLetterhead, attachment, paperSize, reviewerSignature)) onNotify(PRINT_BLOCKED, 'error');
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-[18px]" onClick={onClose}>
      <div
        className="panel max-h-[92vh] w-full max-w-[640px] overflow-y-auto animate-pop-in"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">چاپ نامه مرخصی</h2>
            <p className="mt-1 text-xs text-ink-600">شماره نامه {request.letter_no}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        {vehicleError && <p className="mb-4 text-sm text-error-500">{vehicleError}</p>}

        <div className="grid grid-cols-2 gap-3 max-[650px]:grid-cols-1">
          <LetterField id="letter-driver" label="نام راننده" value={driverName} onChange={setDriverName} />
          <LetterField id="letter-model" label="نوع خودرو" value={vehicleModel} onChange={setVehicleModel} />
          <LetterField id="letter-plate" label="شماره پلاک" value={plate} onChange={setPlate} ltr />
          <LetterField id="letter-origin" label="مبدا" value={origin} onChange={setOrigin} />
          <LetterField id="letter-province" label="استان مقصد" value={province} onChange={setProvince} />
          <LetterField id="letter-city" label="شهر مقصد" value={city} onChange={setCity} />
          <LetterField id="letter-attachment" label="پیوست" value={attachment} onChange={setAttachment} />
          <LetterDateField id="letter-start" label="از تاریخ" value={startDate} onChange={setStartDate} />
          <LetterDateField id="letter-end" label="تا تاریخ" value={endDate} onChange={setEndDate} />
          <LetterField id="letter-days" label="تعداد روز" value={String(days)} onChange={value => setDays(Math.max(1, Math.floor(Number(value)) || 1))} type="number" ltr />
        </div>

        <div className="mt-5 flex flex-col gap-[7px]">
          <label htmlFor="leave-letter-paper-size" className="text-xs text-ink-600">اندازه کاغذ</label>
          <select id="leave-letter-paper-size" value={paperSize} onChange={event => setPaperSize(event.target.value as 'A4' | 'A5')} className="field-input">
            <option value="A4">A4 — ۲۱۰ × ۲۹۷ میلی‌متر</option>
            <option value="A5">A5 — ۱۴۸ × ۲۱۰ میلی‌متر</option>
          </select>
        </div>

        <div className="mt-5 flex flex-col gap-[7px]">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="letter-body" className="text-xs text-ink-600">متن نامه (قابل ویرایش)</label>
            {customBody !== null && (
              <button type="button" className="btn-tiny" onClick={() => setCustomBody(null)}>
                <RotateCcw size={13} />
                بازگشت به متن پیش‌فرض
              </button>
            )}
          </div>
          <textarea
            id="letter-body"
            rows={7}
            value={body}
            onChange={event => setCustomBody(event.target.value)}
            className="field-input leading-[1.9]"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            انصراف
          </button>
          <button type="button" className="btn" onClick={() => handlePrint(true)}>
            <Printer size={16} />
            چاپ با سربرگ
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => handlePrint(false)}>
            <Printer size={16} />
            چاپ بدون سربرگ
          </button>
        </div>
      </div>
    </div>
  );
}

type LetterFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  ltr?: boolean;
};

function LetterField({ id, label, value, onChange, type = 'text', ltr = false }: LetterFieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-xs text-ink-600">{label}</label>
      <input
        id={id}
        type={type}
        min={type === 'number' ? 1 : undefined}
        dir={ltr ? 'ltr' : undefined}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="field-input"
      />
    </div>
  );
}

type LetterDateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function LetterDateField({ id, label, value, onChange }: LetterDateFieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-xs text-ink-600">{label}</label>
      <JalaliDateInput id={id} value={value} onChange={onChange} />
    </div>
  );
}
