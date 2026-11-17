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
  managerSignature?: string | null;
};

export function buildLetterHtml(data: LetterheadData): string {
  const correspondentLabel = data.direction === 'incoming' ? 'فرستنده' : 'گیرنده';
  const correspondentHtml = data.correspondent
    ? `<p class="correspondent">${escapeHtml(correspondentLabel)}: ${escapeHtml(data.correspondent)}</p>`
    : '';
  const managerSignatureHtml = data.managerSignature
    ? '<img class="hand-signature" src="' + escapeHtml(data.managerSignature) + '" alt="امضای مدیر" />'
    : '';
  const approvalHtml = data.direction === 'outgoing' && data.managerApproved
    ? `<div class="approval-signature"><div class="manager-name">اسحاق قربانی</div><div class="manager-title">سرپرست سازمان مدیریت<br>حمل و نقل شهرداری تالش</div><div class="signature-stack">${managerSignatureHtml}<div class="seal">${municipalSealSvg('official')}</div></div></div><style>.content{padding-bottom:48mm}.approval-signature{position:absolute;left:0;bottom:0;width:72mm;min-height:42mm;text-align:center;font-size:10pt;font-weight:700;line-height:1.7;color:#182b28}.approval-signature .manager-name{padding-top:1mm}.approval-signature .manager-title{font-size:9pt;line-height:1.5}.approval-signature .signature-stack{position:relative;width:54mm;height:25mm;margin:1mm auto 0}.approval-signature .hand-signature{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);width:48mm;height:18mm;object-fit:contain}.approval-signature .seal{position:absolute;z-index:3;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-7deg);width:40mm;opacity:.86;mix-blend-mode:multiply;pointer-events:none}.approval-signature .seal svg{display:block;width:100%;height:auto}</style>`
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
