import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import OrganizationContactCard from '@/components/OrganizationContactCard';
import DashboardStats from '@/components/DashboardStats';
import Notice from '@/components/Notice';
import ExpertsPanel from '@/components/ExpertsPanel';
import StatusBadge from '@/components/StatusBadge';
import { DONE_STATUS, ENTITY_KEYS, entityConfigs, type EntityKey, type FleetData, type PageKey } from '@/lib/fleetConfig';
import { LICENSE_PENDING_STATUS } from '@/lib/driverLicenses';
import { buildFleetStats } from '@/lib/fleetStats';
import { formatNumber, formatPersianDate, isPastDate } from '@/lib/format';
import { LEAVE_STATUS_LABELS, type LeaveRequest } from '@/lib/leave';
import { supabase } from '@/lib/supabase';

type DashboardProps = {
  data: FleetData;
  isManager: boolean;
  onNavigate: (page: PageKey) => void;
};

const quickActions: { page: EntityKey; title: string; description: string }[] = [
  { page: 'drivers', title: 'ثبت راننده', description: 'اطلاعات و وضعیت رانندگان' },
  { page: 'vehicles', title: 'ثبت خودرو', description: 'پلاک و وضعیت بیمه' },
  { page: 'documents', title: 'مدیریت مدارک', description: 'مدارک و تاریخ انقضا' },
  { page: 'reminders', title: 'یادآوری جدید', description: 'پیگیری موعدها' },
  { page: 'licenses', title: 'پروانه‌ها', description: 'پروانه و مجوز فعالیت' },
  { page: 'violations', title: 'ثبت تخلف', description: 'سوابق تخلفات' },
];

const LEAVE_LOAD_ERROR = 'اطلاعات مرخصی‌ها دریافت نشد.';

function countDueRecords(data: FleetData): number {
  return ENTITY_KEYS.reduce((total, key) => {
    const dateFields = entityConfigs[key].dateFields ?? [];
    return total + data[key].filter(record => dateFields.some(field => isPastDate(record[field]))).length;
  }, 0);
}

export default function Dashboard({ data, isManager, onNavigate }: DashboardProps) {
  const [leaves, setLeaves] = useState<LeaveRequest[] | null>(null);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [leaveError, setLeaveError] = useState(false);
  const dueCount = countDueRecords(data);
  const pendingLicenseCount = data.licenses.filter(license => license.status === LICENSE_PENDING_STATUS).length;

  useEffect(() => {
    let active = true;
    (async () => {
      const [recent, pending] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('*, drivers(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      if (!active) return;
      if (recent.error || pending.error || !Array.isArray(recent.data)) {
        setLeaveError(true);
        return;
      }
      setLeaves(recent.data as LeaveRequest[]);
      setPendingLeaveCount(pending.count ?? 0);
    })();
    return () => {
      active = false;
    };
  }, []);

  const stats = buildFleetStats(data, pendingLeaveCount);
  const openReminders = data.reminders.filter(reminder => reminder.status !== DONE_STATUS);

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-brand-100 bg-gradient-to-l from-white via-white to-brand-50 p-5 shadow-[0_3px_16px_#163c3208] max-[650px]:items-start max-[650px]:p-4">
        <div>
          <h2 className="mb-1 text-[22px] font-extrabold text-brand-900 max-[650px]:text-lg">داشبورد مدیریت</h2>
          <p className="text-ink-600 max-[650px]:text-xs max-[650px]:leading-[1.8]">
            نمای یکپارچه وضعیت ناوگان، درخواست‌ها و امور اداری تاکسیرانی تالش
          </p>
        </div>
        <button type="button" className="btn max-[650px]:hidden" onClick={() => onNavigate('drivers')}>
          <Plus size={18} />
          ثبت راننده
        </button>
      </div>

      <DashboardStats stats={stats} />

      <div className="grid grid-cols-[1.2fr_1fr] items-start gap-5 max-[1000px]:grid-cols-1">
        <section className="panel min-w-0 p-5 max-[650px]:p-4">
          <div className="mb-[17px] flex items-center justify-between gap-3">
            <h3 className="text-base font-bold">دسترسی سریع</h3>
            <span className="text-sm text-ink-600">مدیریت اطلاعات</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map(({ page, title, description }) => {
              const Icon = entityConfigs[page].icon;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onNavigate(page)}
                  className="group flex min-h-[112px] flex-col items-start rounded-xl border border-ink-200 bg-white p-4 text-right transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm max-[650px]:min-h-[104px] max-[650px]:p-3"
                >
                  <span className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700 transition duration-200 group-hover:bg-brand-600 group-hover:text-white">
                    <Icon size={18} />
                  </span>
                  <span className="block font-bold">{title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-600">{description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-[17px]">
          <section className="panel p-5 max-[650px]:p-4">
            <div className="mb-[17px] flex items-center justify-between gap-3">
              <h3 className="text-base font-bold">آخرین مرخصی‌ها</h3>
              <button type="button" className="btn btn-secondary" onClick={() => onNavigate('leave')}>
                مشاهده همه
              </button>
            </div>
            {leaveError && <p className="py-[30px] text-center text-error-500">{LEAVE_LOAD_ERROR}</p>}
            {!leaveError && leaves && leaves.length === 0 && (
              <p className="py-[30px] text-center text-ink-600">درخواست مرخصی ثبت نشده است.</p>
            )}
            {leaves?.map(leave => (
              <div key={leave.id} className="flex items-center justify-between gap-3 border-b border-ink-200 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-bold">{leave.drivers?.name ?? 'راننده'}</p>
                  <p className="text-xs text-ink-600">
                    {leave.leave_type} · {formatPersianDate(leave.start_date)} تا {formatPersianDate(leave.end_date)}
                  </p>
                </div>
                <StatusBadge status={LEAVE_STATUS_LABELS[leave.status]} />
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="mb-[17px] flex items-center justify-between gap-3">
              <h3 className="text-base font-bold">یادآوری‌های باز</h3>
              <button type="button" className="btn btn-secondary" onClick={() => onNavigate('reminders')}>
                مشاهده همه
              </button>
            </div>
            {openReminders.length === 0 ? (
              <p className="py-[30px] text-center text-ink-600">یادآوری بازی ثبت نشده است.</p>
            ) : (
              openReminders.slice(0, 5).map(reminder => (
                <div key={reminder.id} className="flex items-start gap-3 border-b border-ink-200 py-3 last:border-0">
                  <span className="mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full bg-gold-400" />
                  <div>
                    <p className="font-bold">{reminder.title ?? 'بدون عنوان'}</p>
                    <p className="text-xs text-ink-600">
                      {reminder.remind_on ? formatPersianDate(String(reminder.remind_on)) : 'بدون تاریخ'} · {reminder.category ?? 'عمومی'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="panel">
            <div className="mb-[17px]">
              <h3 className="text-base font-bold">وضعیت اطلاعات</h3>
            </div>
            <Notice title={`${formatNumber(data.vehicles.length)} خودرو`} detail="در سامانه ثبت شده" />
            <Notice title={`${formatNumber(dueCount)} مورد دارای تاریخ منقضی`} detail="بر اساس تاریخ‌های واردشده" />
            {pendingLicenseCount > 0 && (
              <Notice title={`${formatNumber(pendingLicenseCount)} پروانه در انتظار تأیید`} detail="ثبت‌شده توسط راننده و نیازمند بررسی کارشناس" />
            )}
            <p className="mt-3 text-xs text-ink-600">اطلاعات روی سرور ذخیره می‌شوند و از هر دستگاهی در دسترس هستند.</p>
          </section>
          <OrganizationContactCard />
          {isManager && <ExpertsPanel onNavigate={onNavigate} />}
        </div>
      </div>
    </>
  );
}
