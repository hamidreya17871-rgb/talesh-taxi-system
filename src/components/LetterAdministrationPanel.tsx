import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Download, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

type PrioritySetting = { priority: 'normal' | 'urgent' | 'immediate'; working_days: number };
type Holiday = { id: string; holiday_date: string; title: string };
type Referral = {
  id: string;
  referred_to: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  due_at: string | null;
  reviewer: { full_name: string | null } | { full_name: string | null }[] | null;
};
type StaffMetric = {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  cohortCompleted: number;
  openNow: number;
  overdueNow: number;
  completionDays: number[];
};

const PRIORITIES = [
  { key: 'normal' as const, label: 'عادی' },
  { key: 'urgent' as const, label: 'فوری' },
  { key: 'immediate' as const, label: 'آنی' },
];

const monthNow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`;
};

const monthBounds = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
  return {
    start: new Date(`${month}-01T00:00:00+03:30`).toISOString(),
    end: new Date(`${nextMonth}-01T00:00:00+03:30`).toISOString(),
  };
};

const tehranDate = (value: string) =>
  new Date(value).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' });

export default function LetterAdministrationPanel({ profile, onNotify }: {
  profile: Profile;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
}) {
  const [settings, setSettings] = useState<PrioritySetting[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [month, setMonth] = useState(monthNow());
  const [metrics, setMetrics] = useState<StaffMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    const [settingsResult, holidaysResult] = await Promise.all([
      supabase.from('letter_priority_settings').select('priority, working_days'),
      supabase.from('letter_holidays').select('id, holiday_date, title').order('holiday_date', { ascending: true }),
    ]);
    if (settingsResult.error || holidaysResult.error) {
      onNotify('دریافت تنظیمات مهلت یا تعطیلات انجام نشد. ابتدا migration این بخش باید روی پایگاه داده اجرا شده باشد.', 'error');
      setLoading(false);
      return;
    }
    setSettings((settingsResult.data ?? []) as PrioritySetting[]);
    setHolidays((holidaysResult.data ?? []) as Holiday[]);
    setLoading(false);
  }, [onNotify]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    const { start, end } = monthBounds(month);
    const selection = 'id, referred_to, status, created_at, completed_at, due_at, reviewer:referred_to(full_name)';
    const [assignedResult, completedResult] = await Promise.all([
      supabase.from('letter_referrals').select(selection).gte('created_at', start).lt('created_at', end),
      supabase.from('letter_referrals').select(selection).not('completed_at', 'is', null).gte('completed_at', start).lt('completed_at', end),
    ]);
    if (assignedResult.error || completedResult.error) {
      onNotify('دریافت گزارش عملکرد کارشناسان انجام نشد.', 'error');
      setMetrics([]);
      setReportLoading(false);
      return;
    }
    const assignedRows = (assignedResult.data ?? []) as unknown as Referral[];
    const completedRows = (completedResult.data ?? []) as unknown as Referral[];
    const byStaff = new Map<string, StaffMetric>();
    const ensure = (row: Referral) => {
      const name = Array.isArray(row.reviewer) ? row.reviewer[0]?.full_name : row.reviewer?.full_name;
      if (!byStaff.has(row.referred_to)) {
        byStaff.set(row.referred_to, {
          id: row.referred_to,
          name: name ?? 'کارشناس بدون نام',
          assigned: 0,
          completed: 0,
          cohortCompleted: 0,
          openNow: 0,
          overdueNow: 0,
          completionDays: [],
        });
      }
      return byStaff.get(row.referred_to)!;
    };
    const now = Date.now();
    for (const row of assignedRows) {
      const metric = ensure(row);
      metric.assigned += 1;
      if (row.status === 'done') metric.cohortCompleted += 1;
      if (row.status === 'pending') {
        metric.openNow += 1;
        if (row.due_at && new Date(row.due_at).getTime() < now) metric.overdueNow += 1;
      }
    }
    for (const row of completedRows) {
      const metric = ensure(row);
      metric.completed += 1;
      const days = row.completed_at ? (new Date(row.completed_at).getTime() - new Date(row.created_at).getTime()) / 86400000 : 0;
      if (Number.isFinite(days) && days >= 0) metric.completionDays.push(days);
    }
    setMetrics([...byStaff.values()].sort((a, b) => a.name.localeCompare(b.name, 'fa')));
    setReportLoading(false);
  }, [month, onNotify]);

  useEffect(() => { void loadAdminData(); }, [loadAdminData]);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const totals = useMemo(() => metrics.reduce((sum, row) => ({
    assigned: sum.assigned + row.assigned,
    completed: sum.completed + row.completed,
    cohortCompleted: sum.cohortCompleted + row.cohortCompleted,
    openNow: sum.openNow + row.openNow,
    overdueNow: sum.overdueNow + row.overdueNow,
  }), { assigned: 0, completed: 0, cohortCompleted: 0, openNow: 0, overdueNow: 0 }), [metrics]);

  async function saveSettings() {
    setSaving(true);
    for (const setting of settings) {
      const { error } = await supabase.from('letter_priority_settings').update({
        working_days: setting.working_days,
        updated_at: new Date().toISOString(),
        updated_by: profile.user_id,
      }).eq('priority', setting.priority);
      if (error) {
        onNotify('ذخیره مهلت‌ها ناموفق بود. تغییرات را بررسی و دوباره تلاش کنید.', 'error');
        setSaving(false);
        return;
      }
    }
    onNotify('مهلت‌های اقدام با موفقیت ذخیره شد.');
    setSaving(false);
  }

  async function addHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!holidayDate || !holidayTitle.trim()) return;
    const { data, error } = await supabase.from('letter_holidays')
      .insert({ holiday_date: holidayDate, title: holidayTitle.trim(), created_by: profile.user_id })
      .select('id, holiday_date, title')
      .single();
    if (error || !data) {
      onNotify(error?.code === '23505' ? 'این تاریخ قبلاً به‌عنوان تعطیل ثبت شده است.' : 'ثبت تعطیلی انجام نشد.', 'error');
      return;
    }
    setHolidays(items => [...items, data as Holiday].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)));
    setHolidayDate('');
    setHolidayTitle('');
    onNotify('تعطیلی رسمی ثبت شد.');
  }

  async function removeHoliday(holiday: Holiday) {
    const { error } = await supabase.from('letter_holidays').delete().eq('id', holiday.id);
    if (error) {
      onNotify('حذف تعطیلی انجام نشد.', 'error');
      return;
    }
    setHolidays(items => items.filter(item => item.id !== holiday.id));
    onNotify('تعطیلی از تقویم حذف شد.');
  }

  function exportReport() {
    const rows = [
      ['نام کارشناس', 'ارجاع‌شده در ماه', 'تکمیل‌شده در ماه', 'تکمیل از ارجاع‌های ماه تا امروز', 'باز از ارجاع‌های ماه', 'سررسیدگذشته', 'میانگین روز تا تکمیل'],
      ...metrics.map(row => [
        row.name,
        row.assigned,
        row.completed,
        row.cohortCompleted,
        row.openNow,
        row.overdueNow,
        row.completionDays.length ? (row.completionDays.reduce((a, b) => a + b, 0) / row.completionDays.length).toFixed(1) : '—',
      ]),
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `letter-expert-performance-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">تنظیمات مهلت و گزارش عملکرد کارشناسان</h3>
          <p className="mt-1 text-xs text-ink-600">ویژه مدیر سازمان؛ مهلت‌ها بر اساس روز کاری و تقویم تعطیلات محاسبه می‌شوند.</p>
        </div>
        <button type="button" className="btn-tiny" onClick={() => { void loadAdminData(); void loadReport(); }}>
          <RefreshCw size={14} /> به‌روزرسانی
        </button>
      </div>

      <div className="rounded-xl border border-ink-100 p-3">
        <h4 className="mb-3 text-sm font-bold">مهلت پیش‌فرض هر درجه فوریت</h4>
        {loading ? <p className="text-xs text-ink-500">در حال دریافت…</p> : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {PRIORITIES.map(priority => (
                <label key={priority.key} className="flex flex-col gap-1.5 text-xs">
                  <span>{priority.label} (روز کاری)</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    className="field-input"
                    value={settings.find(item => item.priority === priority.key)?.working_days ?? ''}
                    onChange={event => {
                      const value = Number(event.target.value);
                      setSettings(items => items.map(item => item.priority === priority.key ? { ...item, working_days: value } : item));
                    }}
                  />
                </label>
              ))}
            </div>
            <button type="button" className="btn mt-3" onClick={() => void saveSettings()} disabled={saving || settings.length !== 3 || settings.some(item => !Number.isInteger(item.working_days) || item.working_days < 1 || item.working_days > 30)}>
              <Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره مهلت‌ها'}
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-ink-100 p-3">
        <h4 className="mb-3 text-sm font-bold">تقویم تعطیلات رسمی</h4>
        <form onSubmit={addHoliday} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
          <input type="date" className="field-input" value={holidayDate} onChange={event => setHolidayDate(event.target.value)} required />
          <input type="text" className="field-input" placeholder="عنوان تعطیلی" value={holidayTitle} onChange={event => setHolidayTitle(event.target.value)} required maxLength={120} />
          <button type="submit" className="btn" disabled={!holidayDate || !holidayTitle.trim()}><Plus size={15} /> ثبت تعطیلی</button>
        </form>
        {holidays.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {holidays.map(holiday => (
              <div key={holiday.id} className="flex items-center justify-between gap-2 text-xs">
                <span>{tehranDate(`${holiday.holiday_date}T12:00:00`)} — {holiday.title}</span>
                <button type="button" className="btn-tiny btn-tiny-danger" onClick={() => void removeHoliday(holiday)} aria-label="حذف تعطیلی"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-xs text-ink-500">هنوز تعطیلی ثبت نشده است.</p>}
      </div>

      <div className="border-t border-ink-100 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-bold">گزارش ماهانه عملکرد کارشناسان</h4>
            <p className="mt-1 text-xs text-ink-600">بر مبنای تاریخ ارجاع و زمان ثبت تکمیل؛ سررسیدگذشته‌ها بر اساس وضعیت فعلی محاسبه می‌شوند.</p>
          </div>
          <div className="flex gap-2">
            <input type="month" className="field-input" value={month} onChange={event => setMonth(event.target.value)} aria-label="ماه گزارش" />
            <button type="button" className="btn btn-secondary" onClick={exportReport} disabled={reportLoading || metrics.length === 0}><Download size={14} /> CSV</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">ارجاع ماه</p><p className="text-xl font-bold">{totals.assigned}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">تکمیل در ماه</p><p className="text-xl font-bold">{totals.completed}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">تکمیل ارجاع‌های ماه تا امروز</p><p className="text-xl font-bold">{totals.cohortCompleted}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">باز از ارجاع‌های ماه</p><p className="text-xl font-bold">{totals.openNow}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">سررسیدگذشته از ارجاع‌های ماه</p><p className="text-xl font-bold">{totals.overdueNow}</p></div>
        </div>
        {reportLoading ? <p className="py-5 text-center text-xs text-ink-500">در حال تهیه گزارش…</p> : metrics.length === 0 ? <p className="py-5 text-center text-xs text-ink-500">برای این ماه اطلاعاتی ثبت نشده است.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-xs">
              <thead><tr className="border-b border-ink-200 text-ink-600"><th className="p-2">کارشناس</th><th className="p-2">ارجاع ماه</th><th className="p-2">تکمیل در ماه</th><th className="p-2">تکمیل از ارجاع‌های ماه تا امروز</th><th className="p-2">باز از ارجاع‌های ماه</th><th className="p-2">سررسیدگذشته</th><th className="p-2">میانگین زمان تکمیل (روز)</th></tr></thead>
              <tbody>
                {metrics.map(row => {
                  const average = row.completionDays.length ? row.completionDays.reduce((a, b) => a + b, 0) / row.completionDays.length : null;
                  return <tr key={row.id} className="border-b border-ink-100"><td className="p-2 font-medium">{row.name}</td><td className="p-2">{row.assigned}</td><td className="p-2">{row.completed}</td><td className="p-2">{row.cohortCompleted}</td><td className="p-2">{row.openNow}</td><td className="p-2">{row.overdueNow}</td><td className="p-2">{average === null ? '—' : average.toFixed(1)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
