import { todayIso } from '@/lib/format';
import { buildLetterPageHtml, escapeHtml, openLetterPrintWindow, paragraphsHtml } from '@/lib/letterPage';

export type LetterheadData = {
  letterNo: number | string;
  date: string;
  subject: string;
  body: string;
  correspondent?: string;
  attachment?: string | null;
  direction: 'incoming' | 'outgoing';
  includeLetterhead?: boolean;
  paperSize?: 'A4' | 'A5';
};

export function buildLetterHtml(data: LetterheadData): string {
  const correspondentLabel = data.direction === 'incoming' ? 'فرستنده' : 'گیرنده';
  const correspondentHtml = data.correspondent
    ? `<p class="correspondent">${escapeHtml(correspondentLabel)}: ${escapeHtml(data.correspondent)}</p>`
    : '';
  const contentHtml = `<h2>موضوع: ${escapeHtml(data.subject)}</h2>${correspondentHtml}${paragraphsHtml(data.body)}`;

  return buildLetterPageHtml(`نامه شماره ${data.letterNo}`, {
    letterNo: data.letterNo,
    date: data.date || todayIso(),
    attachment: data.attachment,
    contentHtml,
    includeLetterhead: data.includeLetterhead,
    paperSize: data.paperSize,
  });
}

export function printLetter(data: LetterheadData): boolean {
  return openLetterPrintWindow(buildLetterHtml(data));
}
