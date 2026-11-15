import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import ArchiveUploadModal, { type ArchiveOwnerOption } from '@/components/ArchiveUploadModal';
import {
  ARCHIVE_BUCKET,
  ARCHIVE_CATEGORIES,
  ARCHIVE_CATEGORY_LABELS,
  type ArchiveCategory,
  type ArchiveDocument,
} from '@/lib/archive';
import { formatPersianDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

type Props = {
  profile: Profile;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const SIGNED_URL_SECONDS = 300;
const LOAD_ERROR = 'اطلاعات بایگانی دریافت نشد. لطفاً دوباره تلاش کنید.';
const FILE_ERROR = 'باز کردن فایل انجام نشد. لطفاً دوباره تلاش کنید.';
const DELETE_ERROR = 'حذف مدرک انجام نشد. لطفاً دوباره تلاش کنید.';
const POPUP_BLOCKED = 'پنجره فایل باز نشد. لطفاً اجازه باز شدن پنجره را بدهید.';

type VehicleOwner = { id: string; plate: string | null; model: string | null };
type DriverOwner = { id: string; name: string | null };

function ownerLabel(doc: ArchiveDocument): string {
  if (doc.category === 'driver') return doc.drivers?.name ?? 'راننده';
  if (doc.category === 'vehicle') return [doc.vehicles?.plate, doc.vehicles?.model].filter(Boolean).join(' · ') || 'خودرو';
  return '—';
}

export default function ArchivePage({ profile, onNotify }: Props) {
  const committeeOnly = profile.role === 'expert' && Boolean(profile.is_disciplinary_committee);
  const allowedCategories = committeeOnly ? (['committee'] as ArchiveCategory[]) : [...ARCHIVE_CATEGORIES];
  const [category, setCategory] = useState<ArchiveCategory>(committeeOnly ? 'committee' : 'driver');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [documents, setDocuments] = useState<ArchiveDocument[] | null>(null);
  const [drivers, setDrivers] = useState<DriverOwner[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOwner[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const [documentResult, driverResult, vehicleResult] = await Promise.all([
      supabase.from('archive_documents').select('*, drivers(name), vehicles(plate, model)').is('archived_at', null).order('created_at', { ascending: false }),
      committeeOnly ? Promise.resolve({ data: [] as DriverOwner[], error: null }) : supabase.from('drivers').select('id, name').order('name'),
      committeeOnly ? Promise.resolve({ data: [] as VehicleOwner[], error: null }) : supabase.from('vehicles').select('id, plate, model').order('plate'),
    ]);
    if (documentResult.error || driverResult.error || vehicleResult.error) {
      setLoadError(LOAD_ERROR);
      return;
    }
    setDocuments(documentResult.data as ArchiveDocument[]);
    setDrivers(driverResult.data as DriverOwner[]);
    setVehicles(vehicleResult.data as VehicleOwner[]);
  }, [committeeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const driverOptions: ArchiveOwnerOption[] = useMemo(
    () => drivers.map(driver => ({ id: driver.id, label: driver.name ?? 'راننده' })),
    [drivers],
  );
  const vehicleOptions: ArchiveOwnerOption[] = useMemo(
    () => vehicles.map(vehicle => ({ id: vehicle.id, label: [vehicle.plate, vehicle.model].filter(Boolean).join(' · ') || 'خودرو' })),
    [vehicles],
  );
  const ownerOptions = category === 'driver' ? driverOptions : vehicleOptions;

  const visibleDocuments = useMemo(() => {
    if (!documents) return null;
    return documents.filter(doc => {
      if (doc.category !== category) return false;
      if (!ownerFilter) return true;
      return doc.category === 'driver' ? doc.driver_id === ownerFilter : doc.vehicle_id === ownerFilter;
    });
  }, [documents, category, ownerFilter]);

  const showOwnerFilter = category === 'driver' || category === 'vehicle';

  async function openFile(doc: ArchiveDocument, mode: 'view' | 'print') {
    setBusyId(doc.id);
    const { data, error } = await supabase.storage.from(ARCHIVE_BUCKET).createSignedUrl(doc.file_path, SIGNED_URL_SECONDS);
    setBusyId(null);
    if (error || !data?.signedUrl) {
      onNotify(FILE_ERROR, 'error');
      return;
    }
    const win = window.open(data.signedUrl, '_blank');
    if (!win) {
      onNotify(POPUP_BLOCKED, 'error');
      return;
    }
    if (mode === 'print') {
      win.addEventListener('load', () => win.print(), { once: true });
    }
  }

  async function downloadFile(doc: ArchiveDocument) {
    setBusyId(doc.id);
    const { data, error } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .createSignedUrl(doc.file_path, SIGNED_URL_SECONDS, { download: doc.file_name });
    setBusyId(null);
    if (error || !data?.signedUrl) {
      onNotify(FILE_ERROR, 'error');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = data.signedUrl;
    anchor.download = doc.file_name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function removeDocument(doc: ArchiveDocument) {
    if (!window.confirm(`مدرک «${doc.title}» به بایگانی غیرفعال منتقل شود؟ فایل اصلی حفظ خواهد شد.`)) return;
    setBusyId(doc.id);
    const { error } = await supabase.from('archive_documents').update({ archived_at: new Date().toISOString(), archived_by: (await supabase.auth.getUser()).data.user?.id ?? null }).eq('id', doc.id);
    if (error) {
      setBusyId(null);
      onNotify(DELETE_ERROR, 'error');
      return;
    }
    setBusyId(null);
    onNotify('مدرک بایگانی شد؛ فایل اصلی محفوظ است');
    void load();
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">بایگانی مدارک</h2>
          <p className="mt-1 text-sm text-ink-600">اسکن مدارک، چاپ و نگهداری در بخش‌های مختلف</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            به‌روزرسانی
          </button>
          <button type="button" className="btn" onClick={() => setUploading(true)}>
            <Plus size={16} />
            افزودن مدرک
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="بخش‌های بایگانی">
        {allowedCategories.map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={category === item}
            onClick={() => {
              setCategory(item);
              setOwnerFilter('');
            }}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${category === item ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'}`}
          >
            {ARCHIVE_CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>

      {showOwnerFilter && (
        <div className="flex flex-col gap-[7px] md:max-w-[320px]">
          <label htmlFor="archive-filter-owner" className="text-xs text-ink-600">
            {category === 'driver' ? 'راننده' : 'خودرو'}
          </label>
          <select id="archive-filter-owner" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="field-input">
            <option value="">همه</option>
            {ownerOptions.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      )}

      {documents === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}

      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {visibleDocuments && visibleDocuments.length === 0 && (
        <p className="py-16 text-center text-ink-600">مدرکی در این بخش ثبت نشده است.</p>
      )}

      {visibleDocuments && visibleDocuments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visibleDocuments.map(doc => (
            <li key={doc.id} className="panel flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={20} className="shrink-0 text-brand-600" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{doc.title}</p>
                  <p className="mt-1 truncate text-xs text-ink-600">
                    {ownerLabel(doc)} · {formatPersianDate(doc.created_at)} · {doc.file_name}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-tiny" disabled={busyId === doc.id} onClick={() => void openFile(doc, 'view')}>
                  <ExternalLink size={13} />
                  مشاهده
                </button>
                <button type="button" className="btn-tiny" disabled={busyId === doc.id} onClick={() => void downloadFile(doc)}>
                  <Download size={13} />
                  ذخیره فایل
                </button>
                <button type="button" className="btn-tiny" disabled={busyId === doc.id} onClick={() => void openFile(doc, 'print')}>
                  <Printer size={13} />
                  چاپ
                </button>
                <button type="button" className="btn-tiny btn-tiny-danger" disabled={busyId === doc.id} onClick={() => void removeDocument(doc)}>
                  <Trash2 size={13} />
                  انتقال به بایگانی
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploading && (
        <ArchiveUploadModal
          defaultCategory={category}
          allowedCategories={allowedCategories}
          drivers={driverOptions}
          vehicles={vehicleOptions}
          onClose={() => setUploading(false)}
          onSaved={() => {
            setUploading(false);
            onNotify('مدرک ثبت شد');
            void load();
          }}
        />
      )}
    </section>
  );
}
