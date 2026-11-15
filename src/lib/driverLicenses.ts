import { addJalaliMonths } from '@/lib/jalali';
import { isPastDate, todayIso } from '@/lib/format';
import type { RecordValue } from '@/lib/fleetConfig';

export const LICENSE_FILES_BUCKET = 'driver-licenses';
export const LICENSE_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const LICENSE_VALIDITY_MONTHS = 24;
export const LICENSE_REMINDER_MONTHS_BEFORE_EXPIRY = 1;
export const LICENSE_PENDING_STATUS = 'در حال بررسی';
export const LICENSE_EXPIRED_STATUS = 'منقضی';

const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function licenseFileExtension(file: File): string | null {
  return EXTENSION_BY_TYPE[file.type] ?? null;
}

export function validateLicenseFile(file: File | undefined): string | null {
  if (!file) return 'لطفاً فایل پروانه را انتخاب کنید.';
  if (!licenseFileExtension(file)) return 'فقط فایل PDF، JPG یا PNG قابل قبول است.';
  if (file.size > LICENSE_FILE_MAX_BYTES) return 'حجم فایل نباید بیش از ۵ مگابایت باشد.';
  return null;
}

export function licenseExpiryFromIssue(issuedIso: string): string | null {
  return addJalaliMonths(issuedIso, LICENSE_VALIDITY_MONTHS);
}

export function licenseReminderDate(expiresIso: string): string | null {
  return addJalaliMonths(expiresIso, -LICENSE_REMINDER_MONTHS_BEFORE_EXPIRY);
}

export function effectiveLicenseStatus(status: RecordValue, expiresOn: RecordValue): RecordValue {
  return isPastDate(expiresOn) ? LICENSE_EXPIRED_STATUS : status;
}

export function isLicenseReminderDue(expiresIso: string | null | undefined): boolean {
  if (!expiresIso) return false;
  const reminder = licenseReminderDate(expiresIso);
  const today = todayIso();
  return reminder !== null && today >= reminder && today <= expiresIso;
}
