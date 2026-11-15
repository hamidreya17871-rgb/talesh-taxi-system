import { useEffect, useState } from 'react';
import { gregorianToJalali, isoToJalali, jalaliMonthLength, jalaliToIso, JALALI_MONTHS, toPersianDigits, type JalaliDate } from '@/lib/jalali';

type JalaliDateInputProps = {
  id: string;
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
};

const YEAR_SPAN_BEFORE = 5;
const YEAR_SPAN_AFTER = 10;

function currentJalaliYear(): number {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate()).year;
}

function partsFromValue(value: string): Partial<JalaliDate> {
  return isoToJalali(value) ?? {};
}

export default function JalaliDateInput({ id, value, onChange, required }: JalaliDateInputProps) {
  const [parts, setParts] = useState<Partial<JalaliDate>>(() => partsFromValue(value));

  useEffect(() => {
    setParts(partsFromValue(value));
  }, [value]);

  const baseYear = currentJalaliYear();
  const years = Array.from({ length: YEAR_SPAN_BEFORE + YEAR_SPAN_AFTER + 1 }, (_, index) => baseYear - YEAR_SPAN_BEFORE + index);
  if (parts.year && !years.includes(parts.year)) years.push(parts.year);
  years.sort((a, b) => a - b);

  const dayCount = parts.year && parts.month ? jalaliMonthLength(parts.year, parts.month) : 31;

  function commit(next: Partial<JalaliDate>) {
    const clampedDay = next.day && next.year && next.month
      ? Math.min(next.day, jalaliMonthLength(next.year, next.month))
      : next.day;
    const merged = { ...next, day: clampedDay };
    setParts(merged);
    if (merged.year && merged.month && merged.day) {
      onChange(jalaliToIso({ year: merged.year, month: merged.month, day: merged.day }));
    } else {
      onChange('');
    }
  }

  function numberOrUndefined(raw: string): number | undefined {
    return raw === '' ? undefined : Number(raw);
  }

  return (
    <div className="grid grid-cols-3 gap-2" dir="rtl">
      <select
        id={id}
        aria-label="روز"
        required={required}
        value={parts.day ?? ''}
        onChange={event => commit({ ...parts, day: numberOrUndefined(event.target.value) })}
        className="field-input"
      >
        <option value="">روز</option>
        {Array.from({ length: dayCount }, (_, index) => index + 1).map(day => (
          <option key={day} value={day}>
            {toPersianDigits(day)}
          </option>
        ))}
      </select>
      <select
        id={`${id}-month`}
        aria-label="ماه"
        required={required}
        value={parts.month ?? ''}
        onChange={event => commit({ ...parts, month: numberOrUndefined(event.target.value) })}
        className="field-input"
      >
        <option value="">ماه</option>
        {JALALI_MONTHS.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        id={`${id}-year`}
        aria-label="سال"
        required={required}
        value={parts.year ?? ''}
        onChange={event => commit({ ...parts, year: numberOrUndefined(event.target.value) })}
        className="field-input"
      >
        <option value="">سال</option>
        {years.map(year => (
          <option key={year} value={year}>
            {toPersianDigits(year)}
          </option>
        ))}
      </select>
    </div>
  );
}
