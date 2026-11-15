import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

type Report = {
  id: string;
  full_name: string;
  phone: string;
  violation_type: string;
  taxi_identifier: string | null;
  location: string;
  description: string;
  status: string;
  created_at: string;
};

const STATUSES = ['دریافت‌شده', 'در حال بررسی', 'ارجاع به بازرسی', 'رسیدگی شد', 'مختومه'];

export default function CitizenReportsPanel({ profile }: { profile: Profile }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false);
    const { data, error: queryError } = await supabase
      .from('citizen_violation_reports')
      .select('id, full_name, phone, violation_type, taxi_identifier, location, description, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (queryError) {
      setError(true);
      return;
    }
    setReports((data ?? []) as Report[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(report: Report, status: string) {
    setBusyId(report.id);
    const { error: updateError } = await supabase.from('citizen_violation_reports').update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.user_id,
    }).eq('id', report.id);
    setBusyId(null);
    if (updateError) {
      setError(true);
      return;
    }
    await load();
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={19} className="text-error-500" />
          <div>
            <h3 className="font-bold">گزارش‌های مردمی تخلفات</h3>
            <p className="text-xs text-ink-600">مشخصات تماس فقط برای کارکنان مجاز نمایش داده می‌شود.</p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={15} /> تازه‌سازی</button>
      </div>
      {error && <p className="text-sm text-error-500">دریافت یا به‌روزرسانی گزارش‌ها انجام نشد. دسترسی پایگاه داده را بررسی کنید.</p>}
      {!error && reports.length === 0 && <p className="text-sm text-ink-600">گزارش مردمی ثبت نشده است.</p>}
      {reports.map(report => (
        <article key={report.id} className="flex flex-col gap-3 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold">{report.violation_type}</p>
              <p className="text-xs text-ink-600">{new Date(report.created_at).toLocaleString('fa-IR')}</p>
            </div>
            <span className="rounded-full bg-gold-100 px-3 py-1 text-xs">{report.status}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <p>گزارش‌دهنده: {report.full_name}</p>
            <p>شماره تماس: <a className="text-brand-700" href={`tel:${report.phone}`} dir="ltr">{report.phone}</a></p>
            <p>خودرو/شماره تاکسی: {report.taxi_identifier || 'اعلام نشده'}</p>
            <p>محل و زمان: {report.location}</p>
          </div>
          <p className="whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-sm leading-7">{report.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-ink-600" htmlFor={`citizen-report-${report.id}`}>وضعیت رسیدگی</label>
            <select
              id={`citizen-report-${report.id}`}
              value={report.status}
              disabled={busyId === report.id}
              onChange={event => void updateStatus(report, event.target.value)}
              className="field-input min-w-[180px]"
            >
              {STATUSES.map(status => <option key={status}>{status}</option>)}
            </select>
          </div>
        </article>
      ))}
    </section>
  );
}
