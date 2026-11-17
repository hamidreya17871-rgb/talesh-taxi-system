import { formatPersianDate } from '@/lib/format';

const LETTERHEAD_FILE = '/file_00000000b04481f4b5dfa592b07ecabc.png';

function getLetterheadUrl(): string {
  // The print document is opened as about:blank; use an absolute same-origin URL
  // so the browser never resolves the letterhead against the blank document URL.
  return new URL(LETTERHEAD_FILE, window.location.origin).toString();
}

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
  const dateText = formatPersianDate(input.date);
  const attachmentText = input.attachment?.trim() ? input.attachment.trim() : 'ندارد';

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${paperSize} portrait; margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: ${pageWidth}; height: ${pageHeight}; }
    body { font-family: Tahoma, Arial, sans-serif; color: ${LETTER_INK}; }
    .page { position: relative; width: ${pageWidth}; height: ${pageHeight}; overflow: hidden; background: #fff; }
    .template-image { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:fill; }
    .field { position:absolute; left:7mm; width:35mm; height:9mm; line-height:9mm; text-align:center; font-size:10.5pt; font-weight:700; color:#17211c; overflow:hidden; white-space:nowrap; }
    .field-number { top:8.6mm; }
    .field-date { top:20.8mm; }
    .field-attachment { top:32.9mm; }
    .content { position:absolute; top:84mm; left:17mm; right:17mm; bottom:49mm; overflow:hidden; direction:rtl; text-align:right; font-size:12.5pt; line-height:1.9; color:#202020; }
    .content h2 { font-size:13pt; margin:0 0 3mm; text-align:right; font-weight:800; }
    .content .correspondent { font-weight:700; margin:0 0 3mm; }
    .content p { margin:0 0 2.5mm; text-align:justify; }
    .plain-meta { display:none; }
    .page.plain .template-image,.page.plain .field { display:none; }
    .page.plain .content { top:24mm; left:15mm; right:15mm; bottom:15mm; }
    .page.plain .plain-meta { display:flex; justify-content:space-between; gap:4mm; margin:12mm 15mm 8mm; padding-bottom:5mm; border-bottom:1px solid #bbb; font-size:10pt; }
    @media screen { body { background:#e9eeeb; padding:10px; } .page { margin:0 auto; box-shadow:0 2px 18px #0002; } }
    @media print { html,body { margin:0!important; padding:0!important; } .page { margin:0!important; box-shadow:none!important; } }
  </style>
</head>
<body>
  <div class="page${includeLetterhead ? '' : ' plain'}">
    ${includeLetterhead ? `<img class="template-image" src="${getLetterheadUrl()}" alt="سربرگ رسمی سازمان مدیریت حمل و نقل شهرداری تالش" /><div class="field field-number">${escapeHtml(String(input.letterNo))}</div><div class="field field-date">${escapeHtml(dateText)}</div><div class="field field-attachment">${escapeHtml(attachmentText)}</div>` : `<div class="plain-meta"><span>شماره: ${escapeHtml(String(input.letterNo))}</span><span>تاریخ: ${escapeHtml(dateText)}</span><span>پیوست: ${escapeHtml(attachmentText)}</span></div>`}
    <div class="content">${input.contentHtml}</div>
  </div>
</body>
</html>`;
}

export function openLetterPrintWindow(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return false;

  const showPrintError = (message: string) => {
    if (printWindow.closed) return;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Tahoma,Arial,sans-serif;padding:32px;text-align:center;line-height:2">${escapeHtml(message)}</body></html>`);
    printWindow.document.close();
  };

  const writeAndPrint = async () => {
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      if (html.includes('class="template-image"')) {
        const image = printWindow.document.querySelector<HTMLImageElement>('.template-image');
        if (!image) throw new Error('تصویر سربرگ رسمی پیدا نشد.');
        if (!image.complete) await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => reject(new Error('بارگذاری سربرگ ناموفق بود.')), { once: true });
        });
        if (image.naturalWidth === 0) throw new Error('تصویر سربرگ رسمی بارگذاری نشد؛ چاپ متوقف شد.');
        if (typeof image.decode === 'function') {
          await image.decode().catch(() => {
            if (image.naturalWidth === 0) throw new Error('رمزگشایی تصویر سربرگ ناموفق بود.');
          });
        }
      }
      if (printWindow.document.fonts?.ready) await printWindow.document.fonts.ready;
      if (printWindow.closed) return;
      printWindow.focus();
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (!printWindow.closed) printWindow.print();
      }));
    } catch (error) {
      showPrintError(error instanceof Error ? error.message : 'آماده‌سازی چاپ ناموفق بود.');
    }
  };

  void writeAndPrint();
  return true;
}
