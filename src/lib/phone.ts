const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizePhone(input: string): string {
  return input
    .split('')
    .map(char => {
      const persianIndex = PERSIAN_DIGITS.indexOf(char);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = ARABIC_DIGITS.indexOf(char);
      if (arabicIndex >= 0) return String(arabicIndex);
      return char;
    })
    .join('')
    .replace(/[\s-]/g, '');
}

export function isValidPhone(phone: string): boolean {
  return /^09\d{9}$/.test(phone);
}

export function phoneToAccountEmail(phone: string): string {
  return `${phone}@phone.talesh.app`;
}
