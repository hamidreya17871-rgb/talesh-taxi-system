import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Check, RefreshCw, X, Upload, Download, FileSpreadsheet, KeyRound } from 'lucide-react';
import { callStaffApi } from '@/lib/staffApi';

export type PendingRegistration = {
  user_id: string;
  full_name: string;
  phone: string;
  national_code: string;
  plate: string;
  model: string;
  taxi_row_no: string;
  created_at: string;
};

type Decision = 'approve' | 'reject';
type ImportRow = {
  full_name: string;
  national_code: string;
  phone: string;
  plate: string;
  model: string;
  taxi_row_no: string;
};
type ImportedDriver = { row: number; full_name: string; phone: string; activation_code: string; expires_at: string };
type SkippedRow = { row: number; full_name?: string; phone?: string; reason: string };

type Props = { onNotify: (message: string, kind?: 'success' | 'error') => void; canImport: boolean };

const TEMPLATE = [
  ['نام و نام خانوادگی', 'کد ملی', 'شماره موبایل', 'شماره پلاک', 'مدل خودرو', 'ردیف تاکسی'],
  ['علی رضایی', '۰۰۱۲۳۴۵۶۷۸', '۰۹۱۲۳۴۵۶۷۸۹', 'ایران ۱۲ - ۳۴۵ ب ۶۷', 'پژو ۴۰۵', '۱'],
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function headerKey(value: string): string {
  return value.replace(/[\u200c\s_()-]/g, '').toLowerCase();
}

function mapCsvRows(text: string): ImportRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('فایل باید یک ردیف عنوان و حداقل یک راننده داشته باشد.');
  const headers = rows[0].map(headerKey);
  const aliases: Record<keyof ImportRow, string[]> = {
    full_name: ['نامونامخانوادگی', 'نام', 'fullname', 'name'],
    national_code: ['کدملی', 'nationalcode', 'national_code'],
    phone: ['شماره‌موبایل', 'موبایل', 'تلفن', 'phone'],
    plate: ['شمارهپلاک', 'پلاک', 'plate'],
    model: ['مدلخودرو', 'نوعخودرو', 'مدل', 'model'],
    taxi_row_no: ['ردیفتاکسی', 'شمارهردیف', 'taxirowno', 'taxi_row_no'],
  };
  const positions = {} as Record<keyof ImportRow, number>;
  for (const key of Object.keys(aliases) as Array<keyof ImportRow>) {
    positions[key] = headers.findIndex(header => aliases[key].includes(header));
    if (positions[key] < 0) throw new Error('ستون‌های فایل با قالب نمونه مطابقت ندارد؛ فایل نمونه را دریافت کنید.');
  }
  return rows.slice(1).map(row => ({
    full_name: (row[positions.full_name] ?? '').trim(),
    national_code: (row[positions.national_code] ?? '').trim(),
    phone: (row[positions.phone] ?? '').trim(),
    plate: (row[positions.plate] ?? '').trim(),
    model: (row[positions.model] ?? '').trim(),
    taxi_row_no: (row[positions.taxi_row_no] ?? '').trim(),
  }));
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  const csv = '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RegistrationsPage({ onNotify, canImport }: Props) {
  const [items, setItems] = useState<PendingRegistration[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [imported, setImported] = useState<ImportedDriver[]>([]);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await callStaffApi<{ items: PendingRegistration[] }>('list-registrations');
      setItems(result.items);
      setSelectedIds(current => current.filter(id => result.items.some(item => item.user_id === id)));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'عملیات انجام نشد.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function bulkDecide(decision: Decision) {
    if (!selectedIds.length || bulkBusy) return;
    setBulkBusy(true);
    try {
      const result = await callStaffApi<{ success_count: number; failed_count: number }>('review-registrations', {
        user_ids: selectedIds,
        decision,
      });
      onNotify(`بررسی گروهی تمام شد؛ ${result.success_count} مورد موفق و ${result.failed_count} مورد ناموفق.`, result.failed_count ? 'error' : 'success');
      setSelectedIds([]);
      await load();
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'عملیات گروهی انجام نشد.', 'error');
    }
    setBulkBusy(false);
  }

  function toggleSelected(userId: string) {
    setSelectedIds(current => current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId]);
  }

  async function decide(item: PendingRegistration, decision: Decision) {
    setBusyId(item.user_id);
    try {
      await callStaffApi('review-registration', { user_id: item.user_id, decision });
      onNotify(decision === 'approve' ? 'راننده تأیید شد' : 'درخواست رد شد');
      await load();
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'عملیات انجام نشد.', 'error');
    }
    setBusyId(null);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows([]);
    setImported([]);
    setSkipped([]);
    setImportError(null);
    if (!file) { setSelectedFile(null); return; }
    setSelectedFile(file.name);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('برای ورود اطلاعات از Excel، فایل را با گزینه CSV UTF-8 ذخیره و سپس انتخاب کنید.');
      return;
    }
    try {
      const parsed = mapCsvRows(await file.text());
      if (parsed.length > 500) throw new Error('در هر نوبت حداکثر ۵۰۰ ردیف انتخاب کنید.');
      setRows(parsed);
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : 'خواندن فایل ناموفق بود.');
    }
  }

  async function importFile() {
    if (!rows.length || importBusy) return;
    setImportBusy(true);
    setImportError(null);
    setImported([]);
    setSkipped([]);
    const importedRows: ImportedDriver[] = [];
    const skippedRows: SkippedRow[] = [];
    for (let offset = 0; offset < rows.length; offset += 50) {
      const batch = rows.slice(offset, offset + 50);
      setImportProgress(`در حال ثبت ردیف‌های ${offset + 1} تا ${Math.min(offset + batch.length, rows.length)} از ${rows.length}`);
      try {
        const result = await callStaffApi<{ imported: ImportedDriver[]; skipped: SkippedRow[] }>('import-drivers', { records: batch });
        importedRows.push(...result.imported.map(item => ({ ...item, row: offset + item.row - 1 })));
        skippedRows.push(...result.skipped.map(item => ({ ...item, row: offset + item.row - 1 })));
      } catch (cause) {
        skippedRows.push(...batch.map((_row, index) => ({
          row: offset + index + 2,
          reason: cause instanceof Error ? cause.message : 'ارتباط با سرور برقرار نشد.',
        })));
      }
      setImported([...importedRows]);
      setSkipped([...skippedRows]);
    }
    setImportProgress('');
    setImportBusy(false);
    setRows([]);
    if (importedRows.length > 0) {
      downloadCsv('talesh-driver-activation-codes.csv', [
        ['نام راننده', 'شماره موبایل', 'کد فعال‌سازی', 'مهلت استفاده'],
        ...importedRows.map(item => [item.full_name, item.phone, item.activation_code, new Date(item.expires_at).toLocaleDateString('fa-IR')]),
      ]);
    }
    onNotify(`ورود گروهی تمام شد؛ ${importedRows.length} راننده ثبت و ${skippedRows.length} ردیف رد شد.`, skippedRows.length ? 'error' : 'success');
    await load();
  }

  function downloadActivationCodes() {
    if (!imported.length) return;
    downloadCsv('talesh-driver-activation-codes.csv', [
      ['نام راننده', 'شماره موبایل', 'کد فعال‌سازی', 'مهلت استفاده'],
      ...imported.map(item => [item.full_name, item.phone, item.activation_code, new Date(item.expires_at).toLocaleDateString('fa-IR')]),
    ]);
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">درخواست‌های ثبت‌نام رانندگان</h2>
          <p className="mt-1 text-sm text-ink-600">اطلاعات هر راننده را بررسی و تأیید یا رد کنید.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          <RefreshCw size={16} /> به‌روزرسانی
        </button>
      </header>

      {canImport && <section className="panel flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} />
          <h3 className="font-bold">ورود گروهی رانندگان از Excel</h3>
        </div>
        <p className="text-sm leading-6 text-ink-600">
          فایل Excel را با قالب نمونه تکمیل و با فرمت CSV UTF-8 ذخیره کنید. برای جلوگیری از خطا، هر بار حداکثر ۵۰۰ راننده انتخاب می‌شود و سامانه اطلاعات را در بسته‌های ۵۰تایی پردازش می‌کند.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => downloadCsv('talesh-drivers-template.csv', TEMPLATE)}>
            <Download size={16} /> دریافت قالب Excel
          </button>
          <label className="btn btn-secondary cursor-pointer">
            <Upload size={16} /> انتخاب فایل CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={event => void chooseFile(event)} disabled={importBusy} />
          </label>
        </div>
        {selectedFile && <p className="text-xs text-ink-600">فایل انتخاب‌شده: {selectedFile}</p>}
        {rows.length > 0 && (
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-sm font-semibold">پیش‌نمایش پنج ردیف نخست</p>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-right">
                <thead><tr><th className="p-2">نام</th><th className="p-2">موبایل</th><th className="p-2">پلاک</th><th className="p-2">ردیف</th></tr></thead>
                <tbody>{rows.slice(0, 5).map((item, index) => (
                  <tr key={index}><td className="p-2">{item.full_name || '—'}</td><td className="p-2" dir="ltr">{item.phone || '—'}</td><td className="p-2">{item.plate || '—'}</td><td className="p-2">{item.taxi_row_no || '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-3">
            <p className="text-sm">{rows.length} ردیف آماده ورود است.</p>
            <button type="button" className="btn" onClick={() => void importFile()} disabled={importBusy}>
              <Upload size={16} /> شروع ورود گروهی
            </button>
          </div>
        )}
        {importBusy && <p className="text-sm text-ink-600">{importProgress}</p>}
        {importError && <p className="text-sm text-error-500">{importError}</p>}
        {imported.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 p-3">
            <div className="flex items-center gap-2 font-semibold text-emerald-700">
              <KeyRound size={17} /> {imported.length} حساب ساخته شد؛ کدهای فعال‌سازی آماده دریافت‌اند.
            </div>
            <p className="text-xs leading-6 text-ink-600">
              فایل کدها را دانلود و هر کد را محرمانه فقط به راننده مربوط تحویل دهید. کدها یک‌بارمصرف و تا ۳۰ روز معتبرند؛ پس از تعیین رمز، کد باطل می‌شود.
            </p>
            <button type="button" className="btn" onClick={downloadActivationCodes}>
              <Download size={16} /> دانلود کدهای فعال‌سازی
            </button>
          </div>
        )}
        {skipped.length > 0 && (
          <div className="rounded-xl border border-amber-300 p-3">
            <p className="mb-2 text-sm font-semibold">ردیف‌های واردنشده ({skipped.length})</p>
            <div className="max-h-48 overflow-auto text-xs">
              {skipped.map((item, index) => (
                <p key={`${item.row}-${index}`} className="py-1">ردیف {item.row}: {item.full_name || item.phone || ''} — {item.reason}</p>
              ))}
            </div>
          </div>
        )}
      </section>}

      {items === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}
      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>تلاش دوباره</button>
        </div>
      )}
      {items && items.length === 0 && <p className="py-16 text-center text-ink-600">درخواست در انتظار بررسی وجود ندارد.</p>}
      {items && items.length > 0 && (
        <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={items.length > 0 && items.every(item => selectedIds.includes(item.user_id))}
              onChange={event => setSelectedIds(event.target.checked ? items.map(item => item.user_id) : [])}
            />
            انتخاب همه درخواست‌ها
          </label>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-600">{selectedIds.length} مورد انتخاب شده</span>
              <button type="button" className="btn" disabled={bulkBusy} onClick={() => void bulkDecide('approve')}>
                <Check size={16} /> تأیید گروهی
              </button>
              <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => void bulkDecide('reject')}>
                <X size={16} /> رد گروهی
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(item => (
            <article key={item.user_id} className="panel flex flex-col gap-4">
              <label className="flex items-center gap-2 text-xs text-ink-600">
                <input type="checkbox" checked={selectedIds.includes(item.user_id)} onChange={() => toggleSelected(item.user_id)} />
                انتخاب برای بررسی گروهی
              </label>
              <div>
                <h3 className="font-bold">{item.full_name}</h3>
                <p dir="ltr" className="mt-1 text-sm text-ink-600">{item.phone}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="کد ملی" value={item.national_code} />
                <Detail label="ردیف تاکسی" value={item.taxi_row_no} />
                <Detail label="پلاک خودرو" value={item.plate} />
                <Detail label="مدل خودرو" value={item.model} />
              </dl>
              <div className="flex gap-2">
                <button type="button" className="btn flex-1" disabled={busyId === item.user_id} onClick={() => void decide(item, 'approve')}>
                  <Check size={16} /> تأیید
                </button>
                <button type="button" className="btn btn-secondary flex-1" disabled={busyId === item.user_id} onClick={() => void decide(item, 'reject')}>
                  <X size={16} /> رد
                </button>
              </div>
            </article>
          ))}
        </div>
        </>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-600">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || '—'}</dd>
    </div>
  );
}
