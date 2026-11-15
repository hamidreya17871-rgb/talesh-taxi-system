export const PLATE_LETTERS = ['الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'د', 'ژ', 'س', 'ش', 'ص', 'ط', 'ع', 'ل', 'م', 'ن', 'و', 'ه', 'ی'] as const;

export type PlateLetter = (typeof PLATE_LETTERS)[number];

export type PlateParts = {
  first: string;
  letter: PlateLetter | '';
  middle: string;
  region: string;
};

export const EMPTY_PLATE_PARTS: PlateParts = { first: '', letter: '', middle: '', region: '' };

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toAsciiDigits(value: string): string {
  return value
    .split('')
    .map(char => {
      const persianIndex = PERSIAN_DIGITS.indexOf(char);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = ARABIC_DIGITS.indexOf(char);
      if (arabicIndex >= 0) return String(arabicIndex);
      return char;
    })
    .join('');
}

function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, digit => PERSIAN_DIGITS[Number(digit)]);
}

export function isCompletePlate(parts: PlateParts): boolean {
  return /^\d{2}$/.test(parts.first) && parts.letter !== '' && /^\d{3}$/.test(parts.middle) && /^\d{2}$/.test(parts.region);
}

export function formatPlate(parts: PlateParts): string {
  return toPersianDigits(`ایران ${parts.first} - ${parts.middle} ${parts.letter} ${parts.region}`);
}

const PLATE_PATTERN = new RegExp(`^ایران (\\d{2}) - (\\d{3}) (${PLATE_LETTERS.join('|')}) (\\d{2})$`);

export function parsePlate(value: string): PlateParts | null {
  const match = PLATE_PATTERN.exec(toAsciiDigits(value).trim());
  if (!match) return null;
  return { first: match[1], middle: match[2], letter: match[3] as PlateLetter, region: match[4] };
}
