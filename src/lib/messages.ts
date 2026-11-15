import { formatPersianDate } from '@/lib/format';

export const MESSAGE_MAX_LENGTH = 2000;

export type DriverMessage = {
  id: string;
  body: string;
  created_at: string;
  recipient_driver_id: string | null;
  drivers: { name: string | null }[] | null;
};

export function formatMessageDateTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  return `${formatPersianDate(date.toLocaleDateString('en-CA'))} ساعت ${time}`;
}
