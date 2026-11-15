import type { RecordValue } from '@/lib/fleetConfig';
import { formatJalaliDate, isoToJalali } from '@/lib/jalali';

export type StatusTone = 'ok' | 'warn' | 'bad';

export function formatNumber(value: RecordValue): string {
  if (value === null || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString('fa-IR') : String(value);
}

export function formatPersianDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const jalali = isoToJalali(isoDate);
  return jalali ? formatJalaliDate(jalali) : '—';
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isPastDate(value: RecordValue): boolean {
  return typeof value === 'string' && value < todayIso();
}

export function daysUntil(value: RecordValue): number | null {
  if (typeof value !== 'string' || !value) return null;
  const target = new Date(`${value}T00:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date(`${todayIso()}T00:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function statusTone(status: RecordValue): StatusTone {
  const text = String(status ?? '');
  if (/منقضی|ناقص|غیرفعال|نیازمند|رد شده|اسقاط/.test(text)) return 'bad';
  if (/بررسی|انتظار|باز|ثبت‌شده/.test(text)) return 'warn';
  return 'ok';
}
