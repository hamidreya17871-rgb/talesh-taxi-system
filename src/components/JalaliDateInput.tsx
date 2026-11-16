import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import {
  gregorianToJalali,
  isoToJalali,
  jalaliMonthLength,
  jalaliToIso,
  JALALI_MONTHS,
  toPersianDigits,
  formatJalaliDate,
  type JalaliDate,
} from '@/lib/jalali';

type JalaliDateInputProps = {
  id: string;
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  minDate?: string;
  rangeStart?: string;
};

const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function currentJalaliDate(): JalaliDate {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function shiftMonth(date: JalaliDate, amount: number): JalaliDate {
  const index = date.year * 12 + date.month - 1 + amount;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return { year, month, day: 1 };
}

function isoForDay(year: number, month: number, day: number): string {
  return jalaliToIso({ year, month, day });
}

export default function JalaliDateInput({
  id,
  value,
  onChange,
  required,
  minDate,
  rangeStart,
}: JalaliDateInputProps) {
  const today = localTodayIso();
  const selected = isoToJalali(value);
  const initialView = selected ?? currentJalaliDate();
  const [view, setView] = useState<JalaliDate>({ ...initialView, day: 1 });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const next = isoToJalali(value);
      if (next) setView({ ...next, day: 1 });
    }
  }, [value]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  const dayCount = jalaliMonthLength(view.year, view.month);
  const firstDayIso = isoForDay(view.year, view.month, 1);
  const firstDayWeekday = new Date(`${firstDayIso}T12:00:00`).getDay();
  const leadingCells = (firstDayWeekday + 1) % 7;
  const selectedIso = value;
  const rangeStartIso = rangeStart || '';
  const displayedValue = selected ? formatJalaliDate(selected) : 'انتخاب تاریخ';
  const todayParts = isoToJalali(today);

  function chooseDay(day: number) {
    const nextIso = isoForDay(view.year, view.month, day);
    if (minDate && nextIso < minDate) return;
    onChange(nextIso);
    setOpen(false);
  }

  function goToToday() {
    const current = currentJalaliDate();
    const currentIso = localTodayIso();
    if (minDate && currentIso < minDate) return;
    setView({ ...current, day: 1 });
    onChange(currentIso);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative w-full" dir="rtl">
      <input
        aria-label={`تاریخ ${id}`}
        tabIndex={-1}
        required={required}
        value={value}
        readOnly
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-calendar`}
        onClick={() => setOpen(current => !current)}
        className={`flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-right shadow-sm transition hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${value ? 'border-brand-200 text-ink-900' : 'border-ink-300 text-ink-500'}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <CalendarDays size={17} />
          </span>
          <span className="truncate text-sm font-semibold">{displayedValue}</span>
        </span>
        <span className="text-xs text-ink-500">تقویم</span>
      </button>

      {open && (
        <div
          id={`${id}-calendar`}
          role="dialog"
          aria-label="انتخاب تاریخ شمسی"
          className="absolute right-0 z-[70] mt-2 w-[min(340px,calc(100vw-48px))] rounded-2xl border border-ink-200 bg-white p-3 shadow-[0_18px_55px_#102d2530] animate-pop-in"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setView(current => shiftMonth(current, -1))}
              className="grid h-9 w-9 place-items-center rounded-xl bg-ink-50 text-ink-700 transition hover:bg-brand-100 hover:text-brand-700"
              aria-label="ماه قبل"
            >
              <ChevronRight size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm font-extrabold text-ink-900">{JALALI_MONTHS[view.month - 1]}</p>
              <p className="mt-0.5 text-xs font-medium text-ink-500">{toPersianDigits(view.year)}</p>
            </div>
            <button
              type="button"
              onClick={() => setView(current => shiftMonth(current, 1))}
              className="grid h-9 w-9 place-items-center rounded-xl bg-ink-50 text-ink-700 transition hover:bg-brand-100 hover:text-brand-700"
              aria-label="ماه بعد"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEK_DAYS.map(day => (
              <span key={day} className="py-1 text-center text-[10px] font-bold text-ink-500">{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingCells }, (_, index) => (
              <span key={`empty-${index}`} className="h-9" />
            ))}
            {Array.from({ length: dayCount }, (_, index) => index + 1).map(day => {
              const dayIso = isoForDay(view.year, view.month, day);
              const isSelected = dayIso === selectedIso;
              const isToday = dayIso === today;
              const isDisabled = Boolean(minDate && dayIso < minDate);
              const isInRange = Boolean(rangeStartIso && selectedIso && dayIso >= rangeStartIso && dayIso <= selectedIso);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  aria-label={`${toPersianDigits(day)} ${JALALI_MONTHS[view.month - 1]} ${toPersianDigits(view.year)}`}
                  onClick={() => chooseDay(day)}
                  className={`relative grid h-9 place-items-center rounded-xl text-xs font-semibold transition disabled:cursor-not-allowed disabled:text-ink-300 disabled:opacity-50 ${isSelected ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20' : isInRange ? 'bg-brand-100 text-brand-700' : 'text-ink-800 hover:bg-brand-50 hover:text-brand-700'} ${isToday && !isSelected ? 'ring-1 ring-inset ring-brand-500' : ''}`}
                >
                  {toPersianDigits(day)}
                  {isToday && !isSelected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-600" />}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
            <button
              type="button"
              onClick={goToToday}
              disabled={Boolean(minDate && today < minDate)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
            >
              <Clock3 size={14} />
              امروز
            </button>
            <span className="text-[10px] text-ink-500">
              {todayParts ? `امروز: ${formatJalaliDate(todayParts)}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-bold text-ink-700 transition hover:bg-ink-200"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
