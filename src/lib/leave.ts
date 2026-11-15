import { isoToJalali } from '@/lib/jalali';

export const LEAVE_TYPES = ['استحقاقی', 'استعلاجی', 'بدون حقوق', 'اضطراری', 'سایر'] as const;

export const LEAVE_FREE_DAYS_PER_MONTH = 3;

export function leaveMonthKey(isoDate: string): string | null {
  const jalali = isoToJalali(isoDate);
  return jalali ? `${jalali.year}-${String(jalali.month).padStart(2, '0')}` : null;
}

export function freeLeaveDaysUsed(
  requests: Pick<LeaveRequest, 'start_date' | 'end_date' | 'status'>[],
  referenceIso: string,
): number {
  const monthKey = leaveMonthKey(referenceIso);
  if (!monthKey) return 0;

  let usedDays = 0;
  for (const request of requests) {
    if (request.status === 'rejected') continue;
    const cursor = new Date(`${request.start_date}T00:00:00Z`);
    const end = new Date(`${request.end_date}T00:00:00Z`);
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) continue;
    while (cursor <= end) {
      if (leaveMonthKey(cursor.toISOString().slice(0, 10)) === monthKey) usedDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return usedDays;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type LeaveRequest = {
  id: string;
  letter_no: number;
  driver_id: string;
  leave_type: (typeof LEAVE_TYPES)[number];
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  destination_province: string | null;
  destination_city: string | null;
  status: LeaveStatus;
  created_at: string;
  drivers: { name: string | null } | null;
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'در انتظار بررسی',
  approved: 'تأیید شده',
  rejected: 'رد شده',
};
