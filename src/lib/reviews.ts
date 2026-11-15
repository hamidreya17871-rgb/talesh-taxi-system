import { LICENSE_PENDING_STATUS } from '@/lib/driverLicenses';
import type { EntityKey, FleetRecord } from '@/lib/fleetConfig';

export const LICENSE_APPROVED_STATUS = 'معتبر';
export const OBJECTION_PENDING = 'در انتظار بررسی';
export const OBJECTION_ACCEPTED = 'پذیرفته شد';
export const OBJECTION_REJECTED = 'رد شد';
export const OBJECTION_MIN_LENGTH = 10;
export const OBJECTION_MAX_LENGTH = 2000;

export function reviewLabelFor(entity: EntityKey, record: FleetRecord): string | null {
  if (entity === 'licenses' && record.status === LICENSE_PENDING_STATUS) return 'تایید پروانه';
  if (entity === 'violations' && record.objection_decision === OBJECTION_PENDING) return 'بررسی اعتراض';
  return null;
}
