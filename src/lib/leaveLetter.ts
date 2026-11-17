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

export function buildLeaveLetterHtml(letterNo: number, body: string, includeLetterhead = true, attachment?: string | null, paperSize: 'A4' | 'A5' = 'A4'): string {
  const contentHtml = `
    <h2>موضوع: مجوز تردد</h2>
    ${paragraphsHtml(body)}
    <div class="signatory">
      <div>اسحاق قربانی</div>
      <div>سرپرست سازمان مدیریت حمل و نقل</div>
      <div>شهرداری تالش</div>
      <div class="seal">${municipalSealSvg('leave-permit')}</div>
    </div>
    <style>
      .signatory { position: absolute; left: 0; bottom: 6mm; width: 70mm; text-align: center; font-size: 12pt; font-weight: 700; line-height: 1.7; color: ${LETTER_INK}; }
      .seal { position: absolute; left: 50%; top: -28mm; transform: translateX(-50%); width: 46mm; mix-blend-mode: multiply; }
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

export function printLeaveLetter(letterNo: number, body: string, includeLetterhead = true, attachment?: string | null, paperSize: 'A4' | 'A5' = 'A4'): boolean {
  return openLetterPrintWindow(buildLeaveLetterHtml(letterNo, body, includeLetterhead, attachment, paperSize));
}
