import { LICENSE_PENDING_STATUS } from '@/lib/driverLicenses';
import type { FleetData } from '@/lib/fleetConfig';
import { DONE_STATUS } from '@/lib/fleetConfig';
import { daysUntil, isPastDate } from '@/lib/format';

export type DashboardStat = {
  key: string;
  label: string;
  value: number;
  tone: 'brand' | 'gold' | 'blue' | 'error' | 'neutral';
  icon: 'users' | 'car' | 'file' | 'alert' | 'calendar' | 'shield' | 'bell' | 'folder';
};

const EXPIRING_WITHIN_DAYS = 30;

export function buildFleetStats(data: FleetData, pendingLeaveCount: number): DashboardStat[] {
  const count = <T>(items: T[], predicate: (item: T) => boolean) => items.filter(predicate).length;
  const licenseExpired = (record: FleetData['licenses'][number]) =>
    record.status === 'منقضی' || isPastDate(record.expires_on);
  const licenseExpiring = (record: FleetData['licenses'][number]) => {
    const days = daysUntil(record.expires_on);
    return days !== null && days >= 0 && days <= EXPIRING_WITHIN_DAYS && !licenseExpired(record);
  };

  return [
    { key: 'approved-drivers', label: 'رانندگان تأیید شده', value: count(data.drivers, d => d.status === 'فعال'), tone: 'brand', icon: 'users' },
    { key: 'pending-drivers', label: 'در انتظار تأیید', value: count(data.drivers, d => d.status === 'در انتظار بررسی'), tone: 'gold', icon: 'users' },
    { key: 'active-vehicles', label: 'خودروهای فعال', value: count(data.vehicles, v => v.status === 'فعال'), tone: 'brand', icon: 'car' },
    { key: 'inactive-vehicles', label: 'خودروهای غیرفعال', value: count(data.vehicles, v => v.status === 'غیرفعال'), tone: 'neutral', icon: 'car' },
    { key: 'scrapped-vehicles', label: 'در حال اسقاط', value: count(data.vehicles, v => v.status === 'در حال اسقاط'), tone: 'gold', icon: 'car' },
    { key: 'active-licenses', label: 'پروانه‌های معتبر', value: count(data.licenses, l => l.status === 'معتبر' && !licenseExpired(l)), tone: 'brand', icon: 'file' },
    { key: 'pending-licenses', label: 'پروانه‌های در انتظار تأیید', value: count(data.licenses, l => l.status === LICENSE_PENDING_STATUS), tone: 'gold', icon: 'file' },
    { key: 'expired-licenses', label: 'پروانه منقضی', value: count(data.licenses, licenseExpired), tone: 'error', icon: 'alert' },
    { key: 'expiring-licenses', label: 'پروانه در حال انقضا', value: count(data.licenses, licenseExpiring), tone: 'gold', icon: 'calendar' },
    { key: 'pending-documents', label: 'مدارک تمدید در انتظار', value: count(data.documents, doc => doc.status !== 'کامل'), tone: 'blue', icon: 'folder' },
    { key: 'pending-leaves', label: 'مرخصی‌های معلق', value: pendingLeaveCount, tone: 'blue', icon: 'calendar' },
    { key: 'open-violations', label: 'تخلفات باز', value: count(data.violations, v => v.status !== 'مختومه'), tone: 'error', icon: 'shield' },
    { key: 'open-reminders', label: 'یادآوری باز', value: count(data.reminders, r => r.status !== DONE_STATUS), tone: 'neutral', icon: 'bell' },
  ];
}
