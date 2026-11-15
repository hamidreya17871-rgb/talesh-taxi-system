import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

type Report = {
  id: string;
  reporter_name: string;
  reporter_phone: string | null;
  accused_driver_name: string | null;
  taxi_identifier: string;
  violation_type: string;
  location: string;
  occurred_at: string | null;
  description: string;
  status: string;
  created_at: string;
};

const STATUSES = ['ارسال‌شده', 'دریافت توسط بازرس سازمان', 'در حال بررسی', 'سازش انجام شد', 'ارجاع به کمیته انضباطی', 'مختومه'];

export default function LineInspectorReports({ profile, mode }: { profile: Profile; mode: 'driver' | 'staff' }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [taxi, setTaxi] = useState('');
  const [accused, setAccused] = useState('');
  const [kind, setKind] = useState('رفتار نامناسب');
  const [location, setLocation] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const query = supabase.from('line_violation_reports').select('*').order('created_at', { ascending: false }).limit(100);
    const { data, error: queryError } = await query;
    if (queryError) { setError('دریافت گزارش‌ها انجام نشد.'); return; }
    setError('');
    setReports((data ?? []) as Report[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.driver_id) { setError('حساب راننده به پرونده رانندگی متصل نیست.'); return; }
    setBusy(true); setError(''); setNotice('');
    const { error: insertError } = await supabase.from('line_violation_reports').insert({
      reporter_user_id: profile.user_id,
      reporter_driver_id: profile.driver_id,
      reporter_name: profile.full_name,
      reporter_phone: profile.phone,
      accused_driver_name: accused.trim() || null,
      taxi_identifier: taxi.trim(),
      violation_type: kind,
      location: location.trim(),
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
      description: description.trim(),
    });
    setBusy(false);
    if (insertError) { setError('ارسال گزارش انجام نشد. اتصال حساب و مجوز بازرس خط را بررسی کنید.'); return; }
    setTaxi(''); setAccused(''); setLocation(''); setOccurredAt(''); setDescription('');
    setNotice('گزارش با موفقیت برای بازرس سازمان ارسال شد.');
    await load();
  }

  async function updateStatus(report: Report, status: string) {
    let settlementNote: string | undefined;
    if (status === 'ارجاع به کمیته انضباطی' || status === 'سازش انجام شد') {
      const promptText = status === 'ارجاع به کمیته انضباطی'
        ? 'نتیجه تلاش برای سازش و علت عدم حصول سازش را ثبت کنید:'
        : 'شرح نتیجه سازش را ثبت کنید:';
      const entered = window.prompt(promptText);
      if (!entered || entered.trim().length < 5) {
        setError('برای ثبت نتیجه سازش، توضیح حداقل ۵ نویسه‌ای لازم است.');
        return;
      }
      settlementNote = entered.trim();
    }
    const payload: Record<string, unknown> = {
      status, reviewed_by: profile.user_id, reviewed_at: new Date().toISOString(),
    };
    if (settlementNote) {
      payload.settlement_note = settlementNote;
      payload.settlement_attempted_at = new Date().toISOString();
    }
    if (status === 'ارجاع به کمیته انضباطی') payload.committee_referred_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('line_violation_reports').update(payload).eq('id', report.id);
    if (updateError) { setError('به‌روزرسانی وضعیت انجام نشد.'); return; }
    await load();
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={19} className="text-brand-600" />
          <div>
            <h3 className="font-bold">{mode === 'driver' ? 'گزارش تخلف به‌عنوان بازرس خط' : 'گزارش‌های ارسالی بازرسان خطوط'}</h3>
            <p className="text-xs text-ink-600">{mode === 'driver' ? 'گزارش مستقیماً به کارتابل بازرس سازمان ارسال می‌شود.' : 'کارتابل دریافت و رسیدگی گزارش‌های میدانی'}</p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={15} /> تازه‌سازی</button>
      </div>
      {mode === 'driver' && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ink-600">شماره تاکسی / پلاک خودرو
            <input required maxLength={80} value={taxi} onChange={e => setTaxi(e.target.value)} className="field-input" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">نام راننده مورد گزارش (در صورت اطلاع)
            <input maxLength={120} value={accused} onChange={e => setAccused(e.target.value)} className="field-input" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">نوع تخلف
            <select value={kind} onChange={e => setKind(e.target.value)} className="field-input">
              <option>رفتار نامناسب</option><option>دریافت کرایه غیرمجاز</option><option>عدم رعایت مسیر یا مقررات</option><option>وضعیت نامناسب خودرو</option><option>سوار نکردن مسافر</option><option>سایر موارد</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">محل وقوع
            <input required minLength={3} maxLength={240} value={location} onChange={e => setLocation(e.target.value)} className="field-input" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600 sm:col-span-2">زمان وقوع (اختیاری)
            <input type="datetime-local" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} className="field-input" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600 sm:col-span-2">شرح گزارش
            <textarea required minLength={10} maxLength={3000} rows={3} value={description} onChange={e => setDescription(e.target.value)} className="field-input" />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn" disabled={busy}><Send size={15} /> {busy ? 'در حال ارسال…' : 'ارسال به بازرس سازمان'}</button>
            {notice && <span className="text-sm text-brand-700">{notice}</span>}
          </div>
        </form>
      )}
      {error && <p className="text-sm text-error-500">{error}</p>}
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-bold">{mode === 'driver' ? 'گزارش‌های ارسال‌شده من' : 'گزارش‌های دریافتی'}</h4>
        {reports.length === 0 && <p className="text-sm text-ink-600">گزارشی ثبت نشده است.</p>}
        {reports.map(report => (
          <article key={report.id} className="flex flex-col gap-2 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">{report.violation_type} · {report.taxi_identifier}</strong>
              <span className="rounded-full bg-ink-100 px-3 py-1 text-xs">{report.status}</span>
            </div>
            {mode === 'staff' && <p className="text-xs text-ink-600">بازرس خط: {report.reporter_name} · تماس: {report.reporter_phone || 'ثبت نشده'}</p>}
            <p className="text-xs text-ink-600">راننده مورد گزارش: {report.accused_driver_name || 'نامشخص'} · محل: {report.location}</p>
            <p className="whitespace-pre-wrap text-sm leading-6">{report.description}</p>
            {report.settlement_note && <p className="rounded-lg bg-ink-50 p-2 text-xs text-ink-600">نتیجه تلاش برای سازش: {report.settlement_note}</p>}
            {mode === 'staff' && (
              <label className="flex flex-wrap items-center gap-2 text-xs text-ink-600">وضعیت رسیدگی
                <select value={report.status} onChange={e => void updateStatus(report, e.target.value)} className="field-input min-w-[200px]">
                  {STATUSES.map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
