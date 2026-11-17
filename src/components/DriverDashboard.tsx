import { useEffect, useState } from 'react';
import { CalendarDays, FileText, LayoutDashboard, ShieldAlert, type LucideIcon } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { type FleetData, type FleetRecord, type PageKey, type RecordValue } from '@/lib/fleetConfig';
import LicenseReminderNotice from '@/components/LicenseReminderNotice';
import { effectiveLicenseStatus, LICENSE_PENDING_STATUS } from '@/lib/driverLicenses';
import { formatPersianDate } from '@/lib/format';
import { LEAVE_STATUS_LABELS, type LeaveRequest } from '@/lib/leave';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';
import LineInspectorReports from '@/components/LineInspectorReports';

type Props = {
  data: FleetData;
  profile: Profile;
  onNavigate: (page: PageKey) => void;
};

type LeaveSummary = Pick<LeaveRequest, 'id' | 'leave_type' | 'start_date' | 'end_date' | 'status'>;

const RECENT_LIMIT = 3;

export default function DriverDashboard({ data, profile, onNavigate }: Props) {
  const [leaves, setLeaves] = useState<LeaveSummary[] | null>(null);
  const [leaveError, setLeaveError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: rows, error } = await supabase
        .from('leave_requests')
        .select('id, leave_type, start_date, end_date, status')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error || !Array.isArray(rows)) {
        setLeaveError(true);
        return;
      }
      setLeaves(rows as LeaveSummary[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  const licenses = data.licenses;
  const violations = data.violations;
  const pendingLeaves = leaves?.filter(leave => leave.status === 'pending').length ?? 0;

  return (
    <section className="flex flex-col gap-[22px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="mb-2 text-[22px] font-bold max-[650px]:text-lg">پنل راننده</h2>
          <p className="text-ink-600 max-[650px]:text-xs">خوش آمدید، {profile.full_name}</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-brand-50 text-brand-600">
          <LayoutDashboard size={22} />
        </span>
      </div>

      {profile.is_line_inspector && <LineInspectorReports profile={profile} mode="driver" />}

      <div className="panel flex flex-col gap-4">
        <CardHeader icon={FileText} title="پروانه‌ها" tone="brand" />
        {licenses.length === 0 && <p className="text-ink-600">پروانه‌ای ثبت نشده است</p>}
        {licenses.map(license => (
          <LicenseSummary key={license.id} license={license} />
        ))}
      </div>

      <div className="panel flex flex-col gap-3">
        <CardHeader icon={CalendarDays} title="درخواست‌های مرخصی" tone="blue" />
        {leaveError ? (
          <p className="text-ink-600">اطلاعات مرخصی دریافت نشد</p>
        ) : (
          <>
            <p className="text-[32px] font-bold">{leaves ? leaves.length : '—'}</p>
            <p className="text-sm text-ink-600">{pendingLeaves} در انتظار بررسی</p>
          </>
        )}
      </div>

      <div className="panel flex flex-col gap-3">
        <CardHeader icon={ShieldAlert} title="سوابق تخلف" tone="error" />
        <p className="text-[32px] font-bold">{violations.length}</p>
        <p className="text-sm text-ink-600">مجموع تخلفات ثبت شده</p>
      </div>

      <div className="panel flex flex-col gap-3">
        <h3 className="font-bold">آخرین مرخصی‌ها</h3>
        {leaveError && <p className="text-ink-600">اطلاعات مرخصی دریافت نشد</p>}
        {!leaveError && leaves && leaves.length === 0 && <p className="text-ink-600">درخواست مرخصی ثبت نشده است</p>}
        {leaves?.slice(0, RECENT_LIMIT).map(leave => (
          <div key={leave.id} className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
            <span className="text-sm">
              {formatDate(leave.start_date)} تا {formatDate(leave.end_date)}
            </span>
            <StatusBadge status={LEAVE_STATUS_LABELS[leave.status]} />
          </div>
        ))}
        <button type="button" className="btn btn-secondary self-start" onClick={() => onNavigate('leave')}>
          مشاهده مرخصی‌ها
        </button>
      </div>

      <div className="panel flex flex-col gap-3">
        <h3 className="font-bold">آخرین تخلفات</h3>
        {violations.length === 0 && <p className="text-ink-600">تخلفی ثبت نشده است</p>}
        {violations.slice(0, RECENT_LIMIT).map(record => (
          <ViolationRow key={record.id} record={record} />
        ))}
        {violations.length > 0 && (
          <button type="button" className="btn btn-secondary self-start" onClick={() => onNavigate('violations')}>
            مشاهده همه تخلفات
          </button>
        )}
      </div>
    </section>
  );
}

function LicenseSummary({ license }: { license: FleetRecord }) {
  const expiresOn = typeof license.expires_on === 'string' ? license.expires_on : null;
  return (
    <div className="flex flex-col gap-2 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{displayValue(license.kind)}</p>
        <StatusBadge status={effectiveLicenseStatus(license.status, license.expires_on)} />
      </div>
      <p className="text-sm text-ink-600">
        شماره: {displayValue(license.number)} · انقضا: {formatDate(license.expires_on)}
      </p>
      {license.status === LICENSE_PENDING_STATUS && (
        <p className="rounded-[10px] bg-gold-100 px-3 py-2 text-sm text-gold-700">
          این پروانه در انتظار تأیید کارشناس است.
        </p>
      )}
      <LicenseReminderNotice expiresOn={expiresOn} />
    </div>
  );
}

function ViolationRow({ record }: { record: FleetRecord }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayValue(record.kind)}</p>
        <p className="text-xs text-ink-600">{formatDate(record.recorded_on)}</p>
      </div>
      <StatusBadge status={record.status} />
    </div>
  );
}

function CardHeader({ icon: Icon, title, tone }: { icon: LucideIcon; title: string; tone: 'brand' | 'blue' | 'error' }) {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    error: 'bg-error-100 text-error-500',
  }[tone];
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold">{title}</h3>
      <span className={`grid h-10 w-10 place-items-center rounded-[12px] ${toneClass}`}>
        <Icon size={18} />
      </span>
    </div>
  );
}

function displayValue(value: RecordValue | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function formatDate(value: RecordValue | undefined): string {
  return value ? formatPersianDate(String(value)) : '—';
}
