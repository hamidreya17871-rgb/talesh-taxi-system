import { useEffect, useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import Field from '@/components/FormField';
import {
  LICENSE_FILES_BUCKET,
  LICENSE_PENDING_STATUS,
  licenseExpiryFromIssue,
  licenseFileExtension,
  validateLicenseFile,
} from '@/lib/driverLicenses';
import type { FleetRecord, RecordValue } from '@/lib/fleetConfig';
import { formatPersianDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Props = {
  driverId: string;
  driverName: string;
  license?: FleetRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

const LICENSE_KINDS = ['پروانه رانندگی', 'پروانه فعالیت'];
const SAVE_ERROR = 'ذخیره پروانه انجام نشد. لطفاً دوباره تلاش کنید.';
const ISSUE_DATE_REQUIRED = 'لطفاً تاریخ صدور پروانه را وارد کنید.';

function textValue(value: RecordValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default function LicenseUploadModal({ driverId, driverName, license = null, onClose, onSaved }: Props) {
  const isEditing = license !== null;
  const [kind, setKind] = useState(() => textValue(license?.kind) || 'پروانه رانندگی');
  const [number, setNumber] = useState(() => textValue(license?.number));
  const [issuedOn, setIssuedOn] = useState(() => textValue(license?.issued_on));
  const [file, setFile] = useState<File | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const expiresOn = issuedOn ? licenseExpiryFromIssue(issuedOn) : null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issuedOn || !expiresOn) {
      setError(ISSUE_DATE_REQUIRED);
      return;
    }
    if (file || !isEditing) {
      const fileError = validateLicenseFile(file);
      if (fileError) {
        setError(fileError);
        return;
      }
    }
    const extension = file ? licenseFileExtension(file) : null;

    setBusy(true);
    setError(null);
    let filePath: string | null = textValue(license?.file_path) || null;
    if (file && extension) {
      const path = `${driverId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(LICENSE_FILES_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError(SAVE_ERROR);
        setBusy(false);
        return;
      }
      filePath = path;
    }

    const details = {
      kind,
      number: number.trim() || null,
      issued_on: issuedOn,
      expires_on: expiresOn,
      file_path: filePath,
    };

    const { error: saveError } = license
      ? await supabase.from('licenses').update(details).eq('id', license.id)
      : await supabase.from('licenses').insert({
          ...details,
          driver_id: driverId,
          owner: driverName,
          status: LICENSE_PENDING_STATUS,
        });
    if (saveError) {
      if (file && filePath) await supabase.storage.from(LICENSE_FILES_BUCKET).remove([filePath]);
      setError(SAVE_ERROR);
      setBusy(false);
      return;
    }
    const previousPath = textValue(license?.file_path);
    if (file && previousPath && previousPath !== filePath) {
      await supabase.storage.from(LICENSE_FILES_BUCKET).remove([previousPath]);
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-[5] flex items-center justify-center bg-[#0b2824a6] p-[18px] animate-fade-in"
      onClick={event => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-upload-title"
        className="max-h-[90vh] w-full max-w-[480px] animate-pop-in overflow-auto rounded-[18px] bg-white p-6 shadow-[0_20px_70px_#0003]"
      >
        <h3 id="license-upload-title" className="mb-[18px] text-lg font-bold">
          {isEditing ? 'ویرایش پروانه' : 'ثبت پروانه'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="license-kind" className="text-xs text-ink-600">
              نوع پروانه
            </label>
            <select id="license-kind" value={kind} onChange={event => setKind(event.target.value)} required className="field-input">
              {LICENSE_KINDS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <Field id="license-number" label="شماره پروانه" value={number} onChange={setNumber} ltr />
          <Field id="license-issued" label="تاریخ صدور" value={issuedOn} onChange={setIssuedOn} type="date" required />
          <div className="flex flex-col gap-[7px]">
            <span className="text-xs text-ink-600">تاریخ انقضا (دو سال پس از صدور)</span>
            <p className="field-input bg-ink-50 text-ink-700">{expiresOn ? formatPersianDate(expiresOn) : 'پس از انتخاب تاریخ صدور نمایش داده می‌شود'}</p>
          </div>
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="license-file" className="text-xs text-ink-600">
              {isEditing ? 'فایل جدید (اختیاری، PDF، JPG یا PNG، حداکثر ۵ مگابایت)' : 'فایل پروانه (PDF، JPG یا PNG، حداکثر ۵ مگابایت)'}
            </label>
            <input
              id="license-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required={!isEditing}
              onChange={event => setFile(event.target.files?.[0])}
              className="field-input"
            />
          </div>
          {error && <p className="text-sm text-error-500">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button type="submit" className="btn" disabled={busy}>
              <Upload size={16} />
              {busy ? 'در حال ذخیره…' : isEditing ? 'ذخیره تغییرات' : 'ثبت پروانه'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
