import { isoToJalali } from '@/lib/jalali';

export const LEAVE_TYPES = ['استحقاقی', 'استعلاجی', 'بدون حقوق', 'اضطراری', 'سایر'] as const;

export const LEAVE_FREE_DAYS_PER_MONTH = 3;

export function leaveMonthKey(isoDate: string): string | null {
  const jalali = isoToJalali(isoDate);
  return jalali ? `${jalali.year}-${String(jalali.month).padStart(2, '0')}` : null;
}

export function freeLeaveDaysUsed(
  requests: Pick<LeaveRequest, 'start_date' | 'days' | 'status'>[],
  referenceIso: string,
): number {
  const monthKey = leaveMonthKey(referenceIso);
  if (!monthKey) return 0;
  return requests
    .filter(request => request.status !== 'rejected' && leaveMonthKey(request.start_date) === monthKey)
    .reduce((sum, request) => sum + request.days, 0);
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
