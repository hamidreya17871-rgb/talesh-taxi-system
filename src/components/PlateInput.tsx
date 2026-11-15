import { useState } from 'react';
import { EMPTY_PLATE_PARTS, PLATE_LETTERS, formatPlate, isCompletePlate, parsePlate, toAsciiDigits, type PlateParts } from '@/lib/plate';

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export default function PlateInput({ id, value, onChange, required }: Props) {
  const [parts, setParts] = useState<PlateParts>(() => parsePlate(value) ?? EMPTY_PLATE_PARTS);

  function update(field: keyof PlateParts, raw: string) {
    const next = { ...parts, [field]: field === 'letter' ? raw : toAsciiDigits(raw).replace(/\D/g, '') };
    setParts(next);
    onChange(isCompletePlate(next) ? formatPlate(next) : '');
  }

  return (
    <div dir="ltr" className="flex items-center gap-2 rounded-[11px] border border-ink-200 bg-white p-2">
      <div className="grid h-[52px] place-items-center rounded-lg bg-gold-400 px-3 text-sm font-bold text-brand-800" dir="rtl">
        ایران
      </div>
      <input
        id={`${id}-first`}
        aria-label="دو رقم اول"
        inputMode="numeric"
        maxLength={2}
        placeholder="۴۶"
        value={parts.first}
        onChange={e => update('first', e.target.value)}
        className="field-input w-16 text-center"
      />
      <select
        id={`${id}-letter`}
        aria-label="حرف پلاک"
        value={parts.letter}
        onChange={e => update('letter', e.target.value)}
        className="field-input w-20 text-center"
        dir="rtl"
      >
        <option value="">حرف</option>
        {PLATE_LETTERS.map(letter => (
          <option key={letter} value={letter}>{letter}</option>
        ))}
      </select>
      <input
        id={`${id}-middle`}
        aria-label="سه رقم وسط"
        inputMode="numeric"
        maxLength={3}
        placeholder="۶۷۷"
        value={parts.middle}
        onChange={e => update('middle', e.target.value)}
        className="field-input w-20 text-center"
      />
      <input
        id={`${id}-region`}
        aria-label="کد استان"
        inputMode="numeric"
        maxLength={2}
        placeholder="۴۵"
        value={parts.region}
        onChange={e => update('region', e.target.value)}
        className="field-input w-16 text-center"
      />
      <input
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        value={value}
        readOnly
        className="sr-only"
      />
    </div>
  );
}
