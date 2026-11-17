import { formatPersianDate } from '@/lib/format';

const LOGO_FILE = '/talesh-taxi-logo.svg';
const FALLBACK_LOGO_FILE = '/file_00000000b04481f4b5dfa592b07ecabc.png';

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
  const logo = `<img class="logo" src="${LOGO_FILE}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_FILE}'" alt="نشان سازمان حمل‌ونقل و تاکسیرانی تالش">`;

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
    .masthead { position:absolute; inset:0 0 auto; height:58mm; background:#f5d51c; }
    .masthead:after { content:""; position:absolute; left:0; right:0; bottom:0; height:1.1mm; background:#23824a; }
    .meta { position:absolute; left:9mm; top:13mm; width:58mm; display:flex; flex-direction:column; gap:2mm; direction:rtl; }
    .meta-row { height:10mm; display:flex; align-items:center; justify-content:space-between; gap:2mm; padding:0 3mm; border-radius:1.2mm; background:#fff; color:#222; font-size:10.5pt; font-weight:700; }
    .meta-row strong { white-space:nowrap; }
    .meta-row span { flex:1; text-align:center; font-weight:600; }
    .logo-wrap { position:absolute; top:4mm; left:50%; transform:translateX(-50%); width:43mm; height:43mm; display:grid; place-items:center; border:1mm solid #d5a33c; border-radius:50%; background:#fff; padding:1mm; }
    .logo { display:block; width:100%; height:100%; object-fit:contain; border-radius:50%; }
    .flag { position:absolute; top:0; right:0; width:60mm; height:46mm; overflow:hidden; clip-path:polygon(0 0,100% 0,100% 100%); }
    .flag span { position:absolute; top:10mm; right:-5mm; width:75mm; height:4mm; transform:rotate(42deg); transform-origin:center; }
    .flag .green { background:#23934a; top:9mm; }
    .flag .white { background:#fff; top:14mm; }
    .flag .red { background:#d92732; top:19mm; }
    .ribbon { position:absolute; top:56mm; left:50%; transform:translateX(-50%); width:78%; min-height:17mm; display:flex; align-items:center; justify-content:center; border:0.35mm solid #444; border-radius:1mm; background:#fff; color:#404040; font-size:11pt; font-weight:700; text-align:center; z-index:2; }
    .ribbon:before,.ribbon:after { content:""; position:absolute; top:3mm; width:17mm; height:10mm; border:0.3mm solid #555; background:#fff; z-index:-1; }
    .ribbon:before { right:-12mm; clip-path:polygon(0 0,100% 0,75% 50%,100% 100%,0 100%,25% 50%); }
    .ribbon:after { left:-12mm; clip-path:polygon(0 0,100% 0,75% 50%,100% 100%,0 100%,25% 50%); }
    .quote { position:absolute; top:76mm; right:23mm; font-size:9pt; font-weight:700; color:#333; }
    .frame { position:absolute; top:73mm; left:10mm; right:10mm; bottom:13mm; border:0.45mm solid #4d8a67; border-radius:1mm; pointer-events:none; }
    .content { position:absolute; top:91mm; left:21mm; right:21mm; bottom:23mm; overflow:hidden; direction:rtl; text-align:right; font-size:12.5pt; line-height:1.95; color:#202020; }
    .content h2 { font-size:13pt; margin:0 0 3mm; text-align:right; font-weight:800; }
    .content .correspondent { font-weight:700; margin:0 0 3mm; }
    .content p { margin:0 0 2.5mm; text-align:justify; }
    .footer { position:absolute; left:10mm; right:10mm; bottom:3mm; min-height:9mm; display:flex; align-items:center; justify-content:center; padding:1mm 2mm; background:#f3d21b; color:#202020; font-size:8.5pt; font-weight:800; text-align:center; white-space:nowrap; }
    .plain-meta { display:none; }
    .page.plain .masthead,.page.plain .logo-wrap,.page.plain .flag,.page.plain .ribbon,.page.plain .quote,.page.plain .frame,.page.plain .footer,.page.plain .meta { display:none; }
    .page.plain .content { top:24mm; left:15mm; right:15mm; bottom:15mm; }
    .page.plain .plain-meta { display:flex; justify-content:space-between; gap:4mm; margin:12mm 15mm 8mm; padding-bottom:5mm; border-bottom:1px solid #bbb; font-size:10pt; }
    @media screen { body { background:#e9eeeb; padding:10px; } .page { margin:0 auto; box-shadow:0 2px 18px #0002; } }
    @media print { html,body { margin:0!important; padding:0!important; } .page { margin:0!important; box-shadow:none!important; } }
  </style>
</head>
<body>
  <div class="page${includeLetterhead ? '' : ' plain'}">
    ${includeLetterhead ? `<div class="masthead"></div><div class="meta"><div class="meta-row"><strong>شماره:</strong><span>${escapeHtml(String(input.letterNo))}</span></div><div class="meta-row"><strong>تاریخ:</strong><span>${escapeHtml(dateText)}</span></div><div class="meta-row"><strong>پیوست:</strong><span>${escapeHtml(attachmentText)}</span></div></div><div class="logo-wrap">${logo}</div><div class="flag"><span class="green"></span><span class="white"></span><span class="red"></span></div><div class="ribbon">سرمایه‌گذاری برای تولید</div><div class="quote">«مقام معظم رهبری»</div><div class="frame"></div><div class="footer">تالش: بلوار پردیسان، خیابان اندیشه، ساختمان آتش‌نشانی ایستگاه ۲، طبقه دوم&nbsp;&nbsp; | &nbsp;&nbsp;تلفن: ۰۱۳-۴۴۲۳۶۵۳۵</div>` : `<div class="plain-meta"><span>شماره: ${escapeHtml(String(input.letterNo))}</span><span>تاریخ: ${escapeHtml(dateText)}</span><span>پیوست: ${escapeHtml(attachmentText)}</span></div>`}
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

  const writeAndPrint = async (documentHtml: string, expectedLogo: boolean) => {
    try {
      printWindow.document.open();
      printWindow.document.write(documentHtml);
      printWindow.document.close();
      if (expectedLogo) {
        const image = printWindow.document.querySelector<HTMLImageElement>('.logo');
        if (!image) throw new Error('نشان سازمان در سربرگ پیدا نشد.');
        if (typeof image.decode === 'function') await image.decode();
        else if (!image.complete) await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => reject(new Error('بارگذاری نشان سازمان ناموفق بود.')), { once: true });
        });
        if (!image.complete || image.naturalWidth === 0) throw new Error('نشان سازمان بارگذاری نشد؛ چاپ متوقف شد.');
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

  const expectedLogo = html.includes('class="logo"');
  void writeAndPrint(html, expectedLogo);
  return true;
}
