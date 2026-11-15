import { formatPersianDate } from '@/lib/format';

const LETTER_TEMPLATE_FILE = 'file_00000000b04481f4b5dfa592b07ecabc copy 3.png';

export const LETTER_INK = '#182b28';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function paragraphsHtml(text: string): string {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('\n');
}

export type LetterPageInput = {
  letterNo: number | string;
  date: string;
  attachment?: string | null;
  contentHtml: string;
};

export function buildLetterPageHtml(title: string, input: LetterPageInput): string {
  const templateUrl = `${window.location.origin}/${encodeURI(LETTER_TEMPLATE_FILE)}`;
  const dateText = formatPersianDate(input.date);
  const attachmentText = input.attachment?.trim() ? input.attachment.trim() : '-';

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Tahoma, Arial, sans-serif; color: ${LETTER_INK}; }
    .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; }
    .template { position: absolute; left: 0; top: 0; width: 210mm; height: 297mm; }
    .field { position: absolute; left: 7mm; width: 34mm; height: 9mm; line-height: 9mm; text-align: center; font-size: 11pt; font-weight: 700; overflow: hidden; white-space: nowrap; }
    .field-number { top: 8.8mm; }
    .field-date { top: 21.1mm; }
    .field-attachment { top: 33.9mm; }
    .content { position: absolute; left: 14mm; top: 80mm; width: 182mm; height: 182mm; overflow: hidden; font-size: 13pt; line-height: 1.9; }
    .content h2 { font-size: 14pt; margin: 0 0 12px; text-align: center; }
    .content .correspondent { font-weight: 700; margin: 0 0 12px; }
    .content p { margin: 0 0 12px; text-align: justify; }
  </style>
</head>
<body>
  <div class="page">
    <img class="template" src="${templateUrl}" alt="" />
    <div class="field field-number">${escapeHtml(String(input.letterNo))}</div>
    <div class="field field-date">${escapeHtml(dateText)}</div>
    <div class="field field-attachment">${escapeHtml(attachmentText)}</div>
    <div class="content">${input.contentHtml}</div>
  </div>
</body>
</html>`;
}

export function openLetterPrintWindow(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.addEventListener('load', () => printWindow.print(), { once: true });
  return true;
}
