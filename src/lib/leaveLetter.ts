import { formatPersianDate, todayIso } from '@/lib/format';
import { municipalSealSvg } from '@/lib/municipalSeal';
import { buildLetterPageHtml, openLetterPrintWindow, paragraphsHtml, LETTER_INK } from '@/lib/letterPage';

export type LeaveLetterFields = {
  driverName: string;
  vehicleModel: string;
  plate: string;
  startDate: string;
  endDate: string;
  days: number;
  origin: string;
  destinationProvince: string;
  destinationCity: string;
};

export function buildDefaultLetterBody(fields: LeaveLetterFields): string {
  const start = formatPersianDate(fields.startDate);
  const end = formatPersianDate(fields.endDate);
  return `بدینوسیله آقای ${fields.driverName} راننده تاکسی شهری خودرو ${fields.vehicleModel} به شماره پلاک ${fields.plate} از تاریخ ${start} لغایت ${end} به مدت ${fields.days} روز جهت مسافرت از مبدا ${fields.origin} به مقصد استان ${fields.destinationProvince} شهر ${fields.destinationCity} مجاز به تردد بوده و در وقت مقرر مراجعه نمایند.`;
}

export function buildLeaveLetterHtml(letterNo: number, body: string, includeLetterhead = true, attachment?: string | null, paperSize: 'A4' | 'A5' = 'A4', signatureDataUrl?: string | null): string {
  const signatureHtml = signatureDataUrl ? '<img class="hand-signature" src="' + signatureDataUrl + '" alt="امضای تأییدکننده" />' : '';
  const contentHtml = `
    <h2>موضوع: مجوز تردد</h2>
    ${paragraphsHtml(body)}
    <div class="signatory">
      <div>اسحاق قربانی</div>
      <div>سرپرست سازمان مدیریت</div>
      <div>حمل و نقل شهرداری تالش</div>
      <div class="signature-stack">${signatureHtml}<div class="seal">${municipalSealSvg('leave-permit')}</div></div>
    </div>
    <style>
      .signatory { position: absolute; left: 0; bottom: 6mm; width: 70mm; text-align: center; font-size: 12pt; font-weight: 700; line-height: 1.7; color: ${LETTER_INK}; }
      .signature-stack { position:relative; width:48mm; height:31mm; margin:1mm auto 0; }
      .hand-signature { display:block; position:absolute; z-index:2; left:50%; top:50%; transform:translate(-50%,-50%); width:44mm; height:16mm; object-fit:contain; margin:0; }
      .seal { position:absolute; z-index:3; left:50%; top:50%; transform:translate(-50%,-50%) rotate(-5deg); width:29mm; mix-blend-mode:multiply; opacity:.86; pointer-events:none; }
      .seal svg,.seal img { display:block; width:100%; height:auto; }
    </style>`;

  return buildLetterPageHtml(`نامه شماره ${letterNo}`, {
    letterNo,
    date: todayIso(),
    attachment,
    contentHtml,
    includeLetterhead,
    paperSize,
  });
}

export function printLeaveLetter(letterNo: number, body: string, includeLetterhead = true, attachment?: string | null, paperSize: 'A4' | 'A5' = 'A4', signatureDataUrl?: string | null): boolean {
  return openLetterPrintWindow(buildLeaveLetterHtml(letterNo, body, includeLetterhead, attachment, paperSize, signatureDataUrl));
}
