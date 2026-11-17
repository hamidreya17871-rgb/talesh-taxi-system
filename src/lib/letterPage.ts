import { formatPersianDate } from '@/lib/format';

const LETTER_TEMPLATE_FILE = '/file_00000000b04481f4b5dfa592b07ecabc.png';

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
  includeLetterhead?: boolean;
  paperSize?: 'A4' | 'A5';
};

export function buildLetterPageHtml(title: string, input: LetterPageInput): string {
  const includeLetterhead = input.includeLetterhead !== false;
  const paperSize = input.paperSize ?? 'A4';
  const pageWidth = paperSize === 'A5' ? '148mm' : '210mm';
  const pageHeight = paperSize === 'A5' ? '210mm' : '297mm';
  const templateUrl = new URL(LETTER_TEMPLATE_FILE, window.location.href).href;
  const dateText = formatPersianDate(input.date);
  const attachmentText = input.attachment?.trim() ? input.attachment.trim() : '-';

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${paperSize} ${paperSize === 'A5' ? 'portrait' : 'portrait'}; margin: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: ${pageWidth}; height: ${pageHeight}; }
    body { font-family: Tahoma, Arial, sans-serif; color: ${LETTER_INK}; }
    .page { position: relative; width: ${pageWidth}; height: ${pageHeight}; overflow: hidden; background: #fff; }
    .template { position: absolute; display: block; left: 0; top: 0; width: ${pageWidth}; height: ${pageHeight}; object-fit: fill; }
    .field { position: absolute; left: 6mm; width: 52mm; height: 9mm; line-height: 9mm; text-align: right; padding-right: 3mm; font-size: 11pt; font-weight: 700; overflow: hidden; white-space: nowrap; }
    .plain-meta { display: none; }
    .field-number { top: 8.8mm; }
    .field-date { top: 21.1mm; }
    .field-attachment { top: 33.9mm; }
    .content { position: absolute; left: 10mm; top: ${paperSize === 'A5' ? '58mm' : '80mm'}; width: ${paperSize === 'A5' ? '128mm' : '182mm'}; height: ${paperSize === 'A5' ? '130mm' : '182mm'}; overflow: hidden; font-size: 13pt; line-height: 1.9; }
    .page.plain .template, .page.plain .field { display: none; }
    .page.plain .plain-meta { display: flex; justify-content: space-between; gap: 4mm; margin: 12mm 10mm 0; padding-bottom: 6mm; border-bottom: 1px solid #bbb; font-size: 11pt; }
    .page.plain .content { top: ${paperSize === 'A5' ? '32mm' : '36mm'}; height: ${paperSize === 'A5' ? '165mm' : '245mm'}; }
    .content h2 { font-size: 14pt; margin: 0 0 12px; text-align: center; }
    .content .correspondent { font-weight: 700; margin: 0 0 12px; }
    .content p { margin: 0 0 12px; text-align: justify; }
  </style>
</head>
<body>
  <div class="page${includeLetterhead ? '' : ' plain'}">
    ${includeLetterhead ? `<img class="template" src="${templateUrl}" alt="" />` : ''}
    ${includeLetterhead
      ? `<div class="field field-number">${escapeHtml(String(input.letterNo))}</div><div class="field field-date">${escapeHtml(dateText)}</div><div class="field field-attachment">${escapeHtml(attachmentText)}</div>`
      : `<div class="plain-meta"><span>شماره: ${escapeHtml(String(input.letterNo))}</span><span>تاریخ: ${escapeHtml(dateText)}</span><span>پیوست: ${escapeHtml(attachmentText)}</span></div>`}
    <div class="content">${input.contentHtml}</div>
  </div>
</body>
</html>`;
}

export function openLetterPrintWindow(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return false;
  // Open synchronously to avoid mobile popup blockers, then embed the official
  // stationery image as a data URL so about:blank/WebView cannot lose its path.
  const templateUrl = new URL(LETTER_TEMPLATE_FILE, window.location.href).href;
  void fetch(templateUrl, { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Letterhead image could not be loaded');
      return response.blob();
    })
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image data'));
      reader.onerror = () => reject(new Error('Image read failed'));
      reader.readAsDataURL(blob);
    }))
    .catch(() => '')
    .then(dataUrl => {
      const printableHtml = dataUrl
        ? html.replace(templateUrl, dataUrl)
        : html;
      printWindow.document.open();
      printWindow.document.write(printableHtml);
      printWindow.document.close();
      const images = Array.from(printWindow.document.images);
      const ready = Promise.all(images.map(image => {
        if (image.complete && image.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>(resolve => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      }));
      void ready.then(() => {
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 500);
      });
    });
  return true;
}
