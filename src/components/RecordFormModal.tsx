import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { entityConfigs, type EntityKey, type FieldDef, type FleetRecord, type RecordPayload } from '@/lib/fleetConfig';
import JalaliDateInput from '@/components/JalaliDateInput';
import PlateInput from '@/components/PlateInput';

type RecordFormModalProps = {
  entity: EntityKey;
  record: FleetRecord | null;
  drivers: FleetRecord[];
  onSave: (payload: RecordPayload) => Promise<boolean>;
  onClose: () => void;
};

type FormValues = Record<string, string>;

function initialValues(fields: FieldDef[], record: FleetRecord | null): FormValues {
  return Object.fromEntries(
    fields.map(field => {
      if (record) return [field.key, String(record[field.key] ?? '')];
      return [field.key, field.type === 'select' ? (field.options?.[0] ?? '') : ''];
    })
  );
}

function toPayload(fields: FieldDef[], values: FormValues): RecordPayload {
  return Object.fromEntries(
    fields.map(field => {
      const value = values[field.key].trim();
      if (value === '') return [field.key, null];
      return [field.key, field.type === 'number' ? Number(value) : value];
    })
  );
}

export default function RecordFormModal({ entity, record, drivers, onSave, onClose }: RecordFormModalProps) {
  const config = entityConfigs[entity];
  const [values, setValues] = useState<FormValues>(() => initialValues(config.fields, record));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function updateField(key: string) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues(prev => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave(toPayload(config.fields, values));
    if (!saved) setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-[5] flex items-center justify-center bg-[#0b2824a6] p-[18px] animate-fade-in"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-form-title"
        className="max-h-[90vh] w-full max-w-[560px] animate-pop-in overflow-auto rounded-[18px] bg-white p-6 shadow-[0_20px_70px_#0003]"
      >
        <h3 id="record-form-title" className="mb-[18px] text-lg font-bold">
          {record ? 'ویرایش ' : 'افزودن '}
          {config.singular}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-[13px] max-[650px]:grid-cols-1">
            {config.fields.map(field => {
              const fullWidth = field.type === 'textarea' || field.required;
              const id = `field-${field.key}`;
              const value = values[field.key];
              return (
                <div key={field.key} className={`flex flex-col gap-[7px] ${fullWidth ? 'col-span-full' : ''}`}>
                  <label htmlFor={id} className="text-xs text-ink-600">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select id={id} value={value} onChange={updateField(field.key)} className="field-input">
                      {field.options?.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'driver' ? (
                    <select id={id} value={value} onChange={updateField(field.key)} className="field-input">
                      <option value="">بدون راننده</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {String(driver.name ?? '')}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea id={id} value={value} onChange={updateField(field.key)} rows={3} className="field-input min-h-[75px] resize-y" />
                  ) : field.type === 'plate' ? (
                    <PlateInput
                      id={id}
                      value={value}
                      required={field.required}
                      onChange={plate => setValues(prev => ({ ...prev, [field.key]: plate }))}
                    />
                  ) : field.type === 'date' ? (
                    <JalaliDateInput id={id} value={value} onChange={next => setValues(prev => ({ ...prev, [field.key]: next }))} required={field.required} />
                  ) : (
                    <input
                      id={id}
                      type={field.type}
                      value={value}
                      required={field.required}
                      onChange={updateField(field.key)}
                      className="field-input"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex gap-2">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
