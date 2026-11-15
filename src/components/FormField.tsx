import JalaliDateInput from '@/components/JalaliDateInput';

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  minLength?: number;
  inputMode?: 'numeric' | 'tel';
  ltr?: boolean;
};

export default function Field({ id, label, value, onChange, required, type = 'text', minLength, inputMode, ltr }: FieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-xs text-ink-600">
        {label}
      </label>
      {type === 'date' ? (
        <JalaliDateInput id={id} value={value} onChange={onChange} required={required} />
      ) : (
        <input
          id={id}
          type={type}
          required={required}
          minLength={minLength}
          inputMode={inputMode}
          dir={ltr ? 'ltr' : undefined}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="field-input"
        />
      )}
    </div>
  );
}
