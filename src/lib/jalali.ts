export type JalaliDate = { year: number; month: number; day: number };

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const GREGORIAN_MONTH_OFFSETS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const adjustedYear = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((adjustedYear + 3) / 4) -
    Math.floor((adjustedYear + 99) / 100) +
    Math.floor((adjustedYear + 399) / 400) +
    gd +
    GREGORIAN_MONTH_OFFSETS[gm - 1];

  let year = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  year += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    year += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  if (days < 186) {
    return { year, month: 1 + Math.floor(days / 31), day: 1 + (days % 31) };
  }
  return { year, month: 7 + Math.floor((days - 186) / 30), day: 1 + ((days - 186) % 30) };
}

const DAY_MS = 86_400_000;

export function jalaliToGregorian(jy: number, jm: number, jd: number): { year: number; month: number; day: number } {
  const target = jy * 10000 + jm * 100 + jd;
  let cursor = Date.UTC(jy + 621, 2, 21);
  let current = { year: 0, month: 0, day: 0 };
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const date = new Date(cursor);
    current = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    const jalali = gregorianToJalali(current.year, current.month, current.day);
    const key = jalali.year * 10000 + jalali.month * 100 + jalali.day;
    if (key === target) break;
    cursor += key < target ? DAY_MS : -DAY_MS;
  }
  return current;
}


const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function isoToJalali(isoDate: string): JalaliDate | null {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) return null;
  return gregorianToJalali(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function jalaliToIso(date: JalaliDate): string {
  const g = jalaliToGregorian(date.year, date.month, date.day);
  return `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
}

export function addJalaliMonths(isoDate: string, months: number): string | null {
  const jalali = isoToJalali(isoDate);
  if (!jalali) return null;
  const monthIndex = jalali.year * 12 + (jalali.month - 1) + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;
  const day = Math.min(jalali.day, jalaliMonthLength(year, month));
  return jalaliToIso({ year, month, day });
}

export function jalaliMonthLength(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  const lastDay = Date.parse(jalaliToIso({ year, month: 12, day: 29 }));
  const newYear = Date.parse(jalaliToIso({ year: year + 1, month: 1, day: 1 }));
  return (newYear - lastDay) / 86_400_000 === 2 ? 30 : 29;
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, digit => PERSIAN_DIGITS[Number(digit)]);
}

export function formatJalaliDate(date: JalaliDate): string {
  return `${toPersianDigits(date.day)} ${JALALI_MONTHS[date.month - 1]} ${toPersianDigits(date.year)}`;
}
