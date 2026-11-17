import { todayIso } from '@/lib/format';
import { buildLetterPageHtml, escapeHtml, openLetterPrintWindow, paragraphsHtml } from '@/lib/letterPage';
import { municipalSealSvg } from '@/lib/municipalSeal';

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
  managerApproved?: boolean;
  managerName?: string;
};

export function buildLetterHtml(data: LetterheadData): string {
  const correspondentLabel = data.direction === 'incoming' ? 'فرستنده' : 'گیرنده';
  const correspondentHtml = data.correspondent
    ? `<p class="correspondent">${escapeHtml(correspondentLabel)}: ${escapeHtml(data.correspondent)}</p>`
    : '';
  const approvalHtml = data.direction === 'outgoing' && data.managerApproved
    ? `<div class="approval-signature"><div class="signature-label">امضای مدیر</div><div class="manager-name">${escapeHtml(data.managerName?.trim() || 'مدیر سازمان')}</div><div class="seal">${municipalSealSvg('official')}</div></div><style>.content{padding-bottom:48mm}.approval-signature{position:absolute;left:0;bottom:0;width:72mm;min-height:42mm;text-align:center;font-size:10pt;font-weight:700;line-height:1.7;color:#182b28}.approval-signature .signature-label{height:17mm;padding-top:9mm;border-bottom:0.3mm solid #555}.approval-signature .manager-name{padding-top:1mm}.approval-signature .seal{position:absolute;left:50%;top:-4mm;transform:translateX(-50%) rotate(-7deg);width:39mm;opacity:.86;mix-blend-mode:multiply;pointer-events:none}</style>`
    : '';
  const contentHtml = `<h2>موضوع: ${escapeHtml(data.subject)}</h2>${correspondentHtml}${paragraphsHtml(data.body)}${approvalHtml}`;

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
