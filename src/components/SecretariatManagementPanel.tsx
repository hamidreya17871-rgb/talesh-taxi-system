import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatNumber } from '@/lib/format';
import { isoToJalali, JALALI_MONTHS, jalaliToIso } from '@/lib/jalali';
import JalaliDateInput from '@/components/JalaliDateInput';
import type { Profile } from '@/lib/staff';

type Props = {
  profile: Profile;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

type Priority = 'normal' | 'urgent' | 'immediate';
type PrioritySetting = { priority: Priority; working_days: number };
type Holiday = { holiday_date: string; title: string; created_at: string };
type PerformanceRow = {
  staff_user_id: string;
  staff_name: string;
  assigned_count: number;
  completed_count: number;
  pending_at_month_end: number;
  overdue_at_month_end: number;
  average_response_hours: number | null;
  on_time_completed: number;
  on_time_eligible: number;
};

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: 'normal', label: 'عادی' },
  { key: 'urgent', label: 'فوری' },
  { key: 'immediate', label: 'آنی' },
];

const DEFAULT_SETTINGS: PrioritySetting[] = [
  { priority: 'normal', working_days: 5 },
  { priority: 'urgent', working_days: 2 },
  { priority: 'immediate', working_days: 1 },
];

const currentJalali = isoToJalali(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())) ?? { year: 1405, month: 8, day: 1 };

function monthBounds(year: number, month: number) {
  const start = jalaliToIso({ year, month, day: 1 });
  const nextMonthIndex = year * 12 + month;
  const nextYear = Math.floor(nextMonthIndex / 12);
  const nextMonth = nextMonthIndex % 12 + 1;
  const end = jalaliToIso({ year: nextYear, month: nextMonth, day: 1 });
  return { start, end };
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function csvCell(value: string | number) {
  const text = String(value ?? '');
  return '"' + text.replace(/"/g, '""') + '"';
}

export default function SecretariatManagementPanel({ profile, onNotify }: Props) {
  const [year, setYear] = useState(currentJalali.year);
  const [month, setMonth] = useState(currentJalali.month);
  const [settings, setSettings] = useState<PrioritySetting[]>(DEFAULT_SETTINGS);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [report, setReport] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);

  const load = useCallback(async () => {
    setLoading(true);
    setReportError(null);
    const [settingsResult, holidaysResult, reportResult] = await Promise.all([
      supabase.from('letter_priority_settings').select('priority, working_days').order('priority'),
      supabase.from('letter_official_holidays').select('holiday_date, title, created_at').order('holiday_date', { ascending: true }),
      supabase.rpc('get_monthly_secretariat_performance', {
        p_month_start: bounds.start,
        p_month_end: bounds.end,
      }),
    ]);

    if (settingsResult.error) {
      onNotify('دریافت تنظیمات مهلت نامه‌ها انجام نشد.', 'error');
    } else if (settingsResult.data) {
      setSettings(DEFAULT_SETTINGS.map(item => {
        const saved = (settingsResult.data as PrioritySetting[]).find(row => row.priority === item.priority);
        return saved ? { ...item, working_days: saved.working_days } : item;
      }));
    }

    if (holidaysResult.error) {
      onNotify('دریافت تقویم تعطیلات انجام نشد.', 'error');
    } else {
      setHolidays((holidaysResult.data ?? []) as Holiday[]);
    }

    if (reportResult.error) {
      setReportError('گزارش عملکرد دریافت نشد. دسترسی مدیر و اجرای migration را بررسی کنید.');
      setReport([]);
    } else {
      setReport((reportResult.data ?? []) as PerformanceRow[]);
    }
    setLoading(false);
  }, [bounds.start, bounds.end, onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePrioritySettings() {
    if (settings.some(item => !Number.isInteger(item.working_days) || item.working_days < 1 || item.working_days > 30)) {
      onNotify('مهلت هر سطح باید عدد صحیح بین ۱ تا ۳۰ روز کاری باشد.', 'error');
      return;
    }
    setSavingSettings(true);
    const results = await Promise.all(settings.map(item =>
      supabase.from('letter_priority_settings')
        .update({ working_days: item.working_days, updated_at: new Date().toISOString(), updated_by: profile.user_id })
        .eq('priority', item.priority),
    ));
    setSavingSettings(false);
    if (results.some(result => result.error)) {
      onNotify('ذخیره مهلت‌ها انجام نشد. دوباره تلاش کنید.', 'error');
      return;
    }
    onNotify('مهلت‌های دبیرخانه ذخیره شد و سررسید ارجاع‌های باز دوباره محاسبه شد.');
    void load();
  }

  async function addHoliday() {
    if (!holidayDate || !holidayTitle.trim()) {
      onNotify('تاریخ و عنوان تعطیلی را وارد کنید.', 'error');
      return;
    }
    setSavingHoliday(true);
    const { error } = await supabase.from('letter_official_holidays').insert({
      holiday_date: holidayDate,
      title: holidayTitle.trim(),
      created_by: profile.user_id,
    });
    setSavingHoliday(false);
    if (error) {
      onNotify(error.code === '23505' ? 'این تاریخ قبلاً در تقویم تعطیلات ثبت شده است.' : 'ثبت تعطیلی انجام نشد.', 'error');
      return;
    }
    setHolidayDate('');
    setHolidayTitle('');
    onNotify('تعطیلی ثبت شد و سررسید ارجاع‌های باز به‌روزرسانی شد.');
    void load();
  }

  async function removeHoliday(holiday: Holiday) {
    if (!window.confirm(`تعطیلی «${holiday.title}» حذف شود؟ سررسید ارجاع‌های باز دوباره محاسبه خواهد شد.`)) return;
    const { error } = await supabase.from('letter_official_holidays').delete().eq('holiday_date', holiday.holiday_date);
    if (error) {
      onNotify('حذف تعطیلی انجام نشد.', 'error');
      return;
    }
    onNotify('تعطیلی حذف شد و سررسید ارجاع‌های باز به‌روزرسانی شد.');
    void load();
  }

  const totals = useMemo(() => report.reduce((sum, row) => ({
    assigned: sum.assigned + Number(row.assigned_count ?? 0),
    completed: sum.completed + Number(row.completed_count ?? 0),
    pending: sum.pending + Number(row.pending_at_month_end ?? 0),
    overdue: sum.overdue + Number(row.overdue_at_month_end ?? 0),
    onTime: sum.onTime + Number(row.on_time_completed ?? 0),
    eligible: sum.eligible + Number(row.on_time_eligible ?? 0),
  }), { assigned: 0, completed: 0, pending: 0, overdue: 0, onTime: 0, eligible: 0 }), [report]);

  function exportReport() {
    const headers = ['کارشناس', 'ارجاع ثبت‌شده در ماه', 'تکمیل‌شده در ماه', 'باز در پایان ماه', 'معوق در پایان ماه', 'میانگین زمان پاسخ (ساعت)', 'تکمیل به‌موقع', 'مبنای درصد به‌موقع'];
    const rows = report.map(row => [
      row.staff_name,
      row.assigned_count,
      row.completed_count,
      row.pending_at_month_end,
      row.overdue_at_month_end,
      row.average_response_hours ?? '',
      row.on_time_completed,
      row.on_time_eligible,
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `secretariat-performance-${year}-${String(month).padStart(2, '0')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const monthLabel = `${JALALI_MONTHS[month - 1]} ${year.toLocaleString('fa-IR')}`;

  return (
    <section className="flex flex-col gap-4">
      <div className="panel flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 size={19} className="text-brand-600" />
              <h3 className="font-bold">گزارش ماهانه عملکرد کارشناسان</h3>
            </div>
            <p className="mt-1 text-xs text-ink-600">گزارش بر اساس زمان ثبت ارجاع، زمان تکمیل ثبت‌شده و سررسید هر ارجاع</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="سال گزارش" className="field-input min-w-24" value={year} onChange={event => setYear(Number(event.target.value))}>
              {Array.from({ length: 5 }, (_, index) => currentJalali.year - 3 + index).map(value => (
                <option key={value} value={value}>{value.toLocaleString('fa-IR')}</option>
              ))}
            </select>
            <select aria-label="ماه گزارش" className="field-input min-w-32" value={month} onChange={event => setMonth(Number(event.target.value))}>
              {JALALI_MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
            <button type="button" className="btn btn-secondary" onClick={exportReport} disabled={loading || report.length === 0}>
              <Download size={15} /> خروجی CSV
            </button>
          </div>
        </div>

        {reportError && <p className="rounded-lg bg-error-50 p-3 text-sm text-error-600">{reportError}</p>}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-600">ارجاع جدید</p><p className="mt-1 text-xl font-bold">{formatNumber(totals.assigned)}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-600">تکمیل‌شده</p><p className="mt-1 text-xl font-bold">{formatNumber(totals.completed)}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-600">باز در پایان ماه</p><p className="mt-1 text-xl font-bold">{formatNumber(totals.pending)}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-600">معوق در پایان ماه</p><p className="mt-1 text-xl font-bold">{formatNumber(totals.overdue)}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-600">انجام به‌موقع</p><p className="mt-1 text-xl font-bold">{percent(totals.onTime, totals.eligible).toLocaleString('fa-IR')}٪</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-600">کارشناسان فعال</p><p className="mt-1 text-xl font-bold">{formatNumber(report.length)}</p></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-right text-xs">
            <thead><tr className="border-b border-ink-200 text-ink-600">
              <th className="p-2">کارشناس</th><th className="p-2">ارجاع جدید</th><th className="p-2">تکمیل‌شده</th><th className="p-2">باز پایان ماه</th><th className="p-2">معوق پایان ماه</th><th className="p-2">میانگین پاسخ</th><th className="p-2">به‌موقع</th>
            </tr></thead>
            <tbody>
              {report.map(row => (
                <tr key={row.staff_user_id} className="border-b border-ink-100">
                  <td className="p-2 font-medium">{row.staff_name}</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.assigned_count)}</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.completed_count)}</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.pending_at_month_end)}</td>
                  <td className="p-2 tabular-nums">{formatNumber(row.overdue_at_month_end)}</td>
                  <td className="p-2 tabular-nums">{row.average_response_hours == null ? '—' : `${Number(row.average_response_hours).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} ساعت`}</td>
                  <td className="p-2 tabular-nums">{percent(row.on_time_completed, row.on_time_eligible).toLocaleString('fa-IR')}٪</td>
                </tr>
              ))}
              {!loading && report.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-ink-500">برای این ماه کارشناس فعالی یافت نشد.</td></tr>}
            </tbody>
          </table>
        </div>
        {loading && <p className="py-3 text-center text-xs text-ink-500">در حال دریافت گزارش {monthLabel}…</p>}
        <p className="text-[11px] leading-6 text-ink-500">«باز و معوق پایان ماه» وضعیت ارجاع در پایان ماه انتخابی را با استفاده از تاریخ تکمیل ثبت‌شده محاسبه می‌کند. میانگین زمان پاسخ و درصد به‌موقع فقط ارجاع‌هایی را دربرمی‌گیرد که زمان تکمیل و سررسید معتبر دارند؛ سوابق قدیمی فاقد زمان تکمیل در این دو شاخص محاسبه نمی‌شوند.</p>
      </div>

      <div className="panel flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-brand-600" />
          <h3 className="font-bold">تنظیم مهلت پاسخ‌گویی نامه‌ها</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PRIORITIES.map(priority => {
            const value = settings.find(item => item.priority === priority.key)?.working_days ?? 1;
            return (
              <label key={priority.key} className="flex flex-col gap-2 text-sm">
                <span className="font-medium">{priority.label} — روز کاری</span>
                <input
                  type="number" min={1} max={30} step={1} className="field-input"
                  value={value}
                  onChange={event => setSettings(items => items.map(item => item.priority === priority.key ? { ...item, working_days: Number(event.target.value) } : item))}
                />
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-500">محدوده مجاز ۱ تا ۳۰ روز کاری است. پنجشنبه و جمعه و تعطیلات ثبت‌شده در تقویم پایین از محاسبه حذف می‌شوند. با ذخیره تغییرات، سررسید ارجاع‌های باز دوباره محاسبه خواهد شد.</p>
        <div><button type="button" className="btn" onClick={() => void savePrioritySettings()} disabled={savingSettings || loading}><Save size={15} />{savingSettings ? 'در حال ذخیره…' : 'ذخیره مهلت‌ها'}</button></div>
      </div>

      <div className="panel flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-brand-600" />
          <h3 className="font-bold">تقویم تعطیلات رسمی</h3>
        </div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
          <label className="flex flex-col gap-2 text-sm"><span>تاریخ تعطیلی</span><JalaliDateInput id="secretariat-holiday-date" value={holidayDate} onChange={setHolidayDate} /></label>
          <label className="flex flex-col gap-2 text-sm"><span>عنوان تعطیلی</span><input className="field-input" value={holidayTitle} onChange={event => setHolidayTitle(event.target.value)} placeholder="مثلاً تعطیل رسمی" maxLength={200} /></label>
          <button type="button" className="btn" onClick={() => void addHoliday()} disabled={savingHoliday}><Plus size={15} />{savingHoliday ? 'در حال ثبت…' : 'ثبت تعطیلی'}</button>
        </div>
        <div className="flex flex-col gap-2">
          {holidays.map(holiday => (
            <div key={holiday.holiday_date} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2 text-sm">
              <div><span className="font-medium">{holiday.title}</span><span className="mr-2 text-xs text-ink-500">{holiday.holiday_date}</span></div>
              <button type="button" className="btn-tiny btn-tiny-danger" onClick={() => void removeHoliday(holiday)} aria-label={`حذف تعطیلی ${holiday.title}`}><Trash2 size={14} />حذف</button>
            </div>
          ))}
          {holidays.length === 0 && <p className="py-3 text-center text-xs text-ink-500">هنوز تعطیلی‌ای ثبت نشده است.</p>}
        </div>
      </div>
    </section>
  );
}
