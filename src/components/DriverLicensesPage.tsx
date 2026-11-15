import { useState } from 'react';
import { ExternalLink, FileUp, FileX, Pencil } from 'lucide-react';
import LicenseReminderNotice from '@/components/LicenseReminderNotice';
import LicenseUploadModal from '@/components/LicenseUploadModal';
import StatusBadge from '@/components/StatusBadge';
import { LICENSE_FILES_BUCKET, LICENSE_PENDING_STATUS } from '@/lib/driverLicenses';
import type { FleetRecord, RecordValue } from '@/lib/fleetConfig';
import { formatPersianDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

type Props = {
  licenses: FleetRecord[];
  driverId: string | null;
  driverName: string;
  onNotify: (message: string, tone?: 'error') => void;
  onUploaded: () => void;
};

const SIGNED_URL_SECONDS = 300;
const OPEN_ERROR = 'فایل پروانه باز نشد. لطفاً دوباره تلاش کنید.';

export default function DriverLicensesPage({ licenses, driverId, driverName, onNotify, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [editingLicense, setEditingLicense] = useState<FleetRecord | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function handleOpenFile(record: FleetRecord) {
    const path = record.file_path;
    if (typeof path !== 'string' || !path) return;
    setOpeningId(record.id);
    const { data, error } = await supabase.storage.from(LICENSE_FILES_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    setOpeningId(null);
    if (error || !data?.signedUrl) {
      onNotify(OPEN_ERROR, 'error');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  function closeModal() {
    setUploading(false);
    setEditingLicense(null);
  }

  return (
    <section className="flex flex-col gap-[22px]">
      <div className="flex items-center justify-between gap-4 max-[650px]:flex-col max-[650px]:items-stretch">
        <div>
          <h2 className="mb-2 text-[22px] font-bold max-[650px]:text-lg">پروانه‌های من</h2>
          <p className="text-ink-600 max-[650px]:text-xs">مشاهده وضعیت و ثبت اطلاعات پروانه</p>
        </div>
        {driverId && (
          <button type="button" className="btn" onClick={() => setUploading(true)}>
            <FileUp size={16} />
            ثبت پروانه
          </button>
        )}
      </div>

      {!driverId && <p className="text-ink-600">پرونده راننده به حساب شما متصل نیست.</p>}

      {driverId && licenses.length === 0 && (
        <div className="panel text-center text-ink-600">
          <FileX size={28} className="mx-auto mb-3" />
          پروانه‌ای ثبت نشده است
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {licenses.map(record => (
          <article key={record.id} className="panel flex flex-col gap-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold">{displayValue(record.kind)}</h3>
                <p className="mt-1 text-xs text-ink-600">شماره: {displayValue(record.number)}</p>
              </div>
              <StatusBadge status={record.status} />
            </div>
            <div className="flex flex-col gap-1 text-sm text-ink-600">
              <p>صدور: {formatDate(record.issued_on)}</p>
              <p>انقضا: {formatDate(record.expires_on)}</p>
            </div>
            <LicenseReminderNotice expiresOn={textOrNull(record.expires_on)} />
            <div className="flex flex-wrap gap-2">
              {record.file_path ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleOpenFile(record)}
                  disabled={openingId === record.id}
                >
                  <ExternalLink size={16} />
                  {openingId === record.id ? 'در حال باز شدن…' : 'مشاهده فایل'}
                </button>
              ) : (
                <p className="text-xs text-ink-600">فایلی برای این پروانه ثبت نشده است</p>
              )}
              {record.status === LICENSE_PENDING_STATUS && (
                <button type="button" className="btn btn-secondary" onClick={() => setEditingLicense(record)}>
                  <Pencil size={16} />
                  ویرایش
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {(uploading || editingLicense) && driverId && (
        <LicenseUploadModal
          driverId={driverId}
          driverName={driverName}
          license={editingLicense}
          onClose={closeModal}
          onSaved={() => {
            const message = editingLicense ? 'تغییرات پروانه ذخیره شد' : 'پروانه ثبت شد و در انتظار بررسی است';
            closeModal();
            onNotify(message);
            onUploaded();
          }}
        />
      )}
    </section>
  );
}

function displayValue(value: RecordValue | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function textOrNull(value: RecordValue | undefined): string | null {
  return typeof value === 'string' && value ? value : null;
}

function formatDate(value: RecordValue | undefined): string {
  return value ? formatPersianDate(String(value)) : '—';
}
