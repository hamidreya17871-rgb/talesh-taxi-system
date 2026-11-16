import { formatPersianDate, todayIso } from '@/lib/format';
import { buildLetterPageHtml, openLetterPrintWindow, paragraphsHtml, LETTER_INK } from '@/lib/letterPage';

const SEAL_INK = '#1f3fd0';

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

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}

function sealSvg(): string {
  const cx = 150;
  const cy = 118;
  const stars = [-90, -18, 54, 126, 198]
    .map(deg => {
      const rad = (deg * Math.PI) / 180;
      return `<path d="${starPath(cx + 40 * Math.cos(rad), cy + 40 * Math.sin(rad), 13, 5.5)}" fill="${SEAL_INK}" />`;
    })
    .join('');
  return `
    <svg viewBox="0 0 300 275" width="170" height="156" aria-hidden="true" font-family="Tahoma, Arial, sans-serif" fill="${SEAL_INK}">
      <defs>
        <path id="seal-inner-arc" d="M92,${cy} A58,58 0 0,0 208,${cy}" />
        <path id="seal-text-line-1" d="M32,${cy} A118,118 0 0,0 268,${cy}" />
        <path id="seal-text-line-2" d="M14,${cy} A136,136 0 0,0 286,${cy}" />
      </defs>
      <circle cx="${cx}" cy="${cy}" r="104" fill="none" stroke="${SEAL_INK}" stroke-width="4" />
      <circle cx="${cx}" cy="${cy}" r="74" fill="none" stroke="${SEAL_INK}" stroke-width="2.5" />
      ${stars}
      <text font-size="14" font-weight="700"><textPath href="#seal-inner-arc" startOffset="50%" text-anchor="middle">شهرداری تالش</textPath></text>
      <text font-size="15" font-weight="700"><textPath href="#seal-text-line-1" startOffset="50%" text-anchor="middle">سازمان حمل و نقل همگانی</textPath></text>
      <text font-size="15" font-weight="700"><textPath href="#seal-text-line-2" startOffset="50%" text-anchor="middle">شهر تالش و حومه</textPath></text>
    </svg>`;
}

export function buildLeaveLetterHtml(letterNo: number, body: string, includeLetterhead = true, attachment?: string | null, paperSize: 'A4' | 'A5' = 'A4'): string {
  const contentHtml = `
    <h2>موضوع: مجوز تردد</h2>
    ${paragraphsHtml(body)}
    <div class="signatory">
      <div>اسحاق قربانی</div>
      <div>سرپرست سازمان مدیریت حمل و نقل</div>
      <div>شهرداری تالش</div>
      <div class="seal">${sealSvg()}</div>
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
