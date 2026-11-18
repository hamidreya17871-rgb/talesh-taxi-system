import { useMemo, useRef, useState } from 'react';
import { Clipboard, Wand2 } from 'lucide-react';

type DocumentKind = 'letter' | 'reply' | 'minutes' | 'agenda' | 'report' | 'summary' | 'actions';

const KINDS: { value: DocumentKind; label: string; instruction: string }[] = [
  { value: 'letter', label: 'نامه اداری', instruction: 'پیش‌نویس یک نامه اداری رسمی با موضوع، مخاطب، مقدمه، متن اصلی و درخواست یا نتیجه روشن تهیه کن.' },
  { value: 'reply', label: 'پاسخ به نامه وارده', instruction: 'پاسخ رسمی و مستدل به نامه وارده تهیه کن؛ به شماره و تاریخ نامه مرجع اشاره کن و پاسخ هر خواسته را روشن بنویس.' },
  { value: 'minutes', label: 'صورت‌جلسه', instruction: 'یادداشت‌ها را به صورت‌جلسه رسمی شامل تاریخ، محل، حاضران، دستور جلسه، مذاکرات، مصوبات، مسئول هر اقدام و مهلت تبدیل کن.' },
  { value: 'agenda', label: 'دستور جلسه', instruction: 'دستور جلسه منظم و اولویت‌بندی‌شده با زمان پیشنهادی و خروجی مورد انتظار هر موضوع تهیه کن.' },
  { value: 'report', label: 'گزارش مدیریتی', instruction: 'گزارش مدیریتی با خلاصه اجرایی، وضعیت موجود، مسائل، آمارهای ارائه‌شده، پیشنهادها و جمع‌بندی تهیه کن.' },
  { value: 'summary', label: 'خلاصه سند', instruction: 'متن را خلاصه کن و شماره‌ها، تاریخ‌ها، اشخاص، تعهدات و مهلت‌ها را جداگانه استخراج کن.' },
  { value: 'actions', label: 'استخراج مصوبات و پیگیری‌ها', instruction: 'از متن، مصوبات و اقدامات را به جدول شامل اقدام، مسئول، مهلت و وضعیت پیشنهادی استخراج کن؛ موارد نامشخص را حدس نزن.' },
];

export default function AdministrativeWritingAssistant() {
  const [kind, setKind] = useState<DocumentKind>('letter');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [context, setContext] = useState('');
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => {
    const selected = KINDS.find(item => item.value === kind)!;
    return [
      'نقش: کارشناس ارشد دبیرخانه و امور اداری سازمان تاکسیرانی تالش.',
      selected.instruction,
      'لحن رسمی، دقیق، محترمانه و بدون عبارت‌های محاوره‌ای باشد. هیچ نام، شماره، تاریخ، آمار، مصوبه یا تعهدی را جعل نکن. اطلاعات ناقص را با [نیازمند تکمیل] مشخص کن.',
      'خروجی را به زبان فارسی و با قالب‌بندی مناسب سند اداری ارائه کن. متن را پیش‌نویس تلقی کن و برای بازبینی انسانی آماده نگه دار.',
      context.trim() ? 'اطلاعات تکمیلی: ' + context.trim() : '',
      'یادداشت‌ها یا متن مبنا:\n' + notes.trim(),
    ].filter(Boolean).join('\n\n');
  }, [kind, notes, context]);

  function wrapSelection(before: string, after = before) {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = draft.slice(start, end) || 'متن';
    const next = draft.slice(0, start) + before + selected + after + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixLine(prefix: string) {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? draft.length;
    const lineStart = draft.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    setDraft(draft.slice(0, lineStart) + prefix + draft.slice(lineStart));
    requestAnimationFrame(() => {
      editor?.focus();
      editor?.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  async function copyDraft() {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function printDraft() {
    if (!draft.trim()) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const safe = draft.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
    win.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>پیش‌نویس سند اداری</title><style>body{font-family:Tahoma,Arial,sans-serif;line-height:2;padding:28px;white-space:pre-wrap}h1{font-size:20px}</style></head><body>${safe}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Wand2 size={18} className="text-brand-600" />
        <div>
          <h3 className="font-bold">دستیار تدوین اسناد اداری</h3>
          <p className="text-xs text-ink-600">آماده‌سازی دستور دقیق برای نگارش و بازبینی پیش‌نویس‌ها</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-600">
          نوع سند
          <select className="field-input" value={kind} onChange={event => setKind(event.target.value as DocumentKind)}>
            {KINDS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-600">
          اطلاعات تکمیلی (اختیاری)
          <input className="field-input" value={context} onChange={event => setContext(event.target.value)} placeholder="مخاطب، تاریخ، شماره نامه مرجع و..." />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink-600">
        متن خام، یادداشت جلسه یا محتوای سند
        <textarea className="field-input min-h-32" value={notes} onChange={event => setNotes(event.target.value)} placeholder="هرچه در اختیار دارید وارد کنید؛ حتی یادداشت‌های کوتاه و نامرتب..." />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={!notes.trim()} onClick={() => void copyPrompt()}>
          <Clipboard size={15} />
          کپی دستور نگارش
        </button>
        <span className="text-xs text-ink-500">دستور را در ابزار هوش مصنوعی اجرا کنید و پاسخ را در ویرایشگر پایین قرار دهید.</span>
      </div>
      <details className="rounded-lg bg-ink-50 p-3">
        <summary className="cursor-pointer text-xs font-semibold">مشاهده دستور آماده</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink-700">{prompt}</pre>
      </details>

      <div className="flex flex-col gap-2 border-t border-ink-200 pt-4">
        <div>
          <h4 className="font-bold">ویرایشگر پیش‌نویس</h4>
          <p className="mt-1 text-xs text-ink-500">متن تولیدشده یا نوشته خودتان را اینجا وارد و اصلاح کنید. قالب‌بندی به‌صورت Markdown ذخیره می‌شود.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-tiny" onClick={() => wrapSelection('**')}>پررنگ</button>
          <button type="button" className="btn-tiny" onClick={() => wrapSelection('_')}>مورب</button>
          <button type="button" className="btn-tiny" onClick={() => prefixLine('## ')}>عنوان</button>
          <button type="button" className="btn-tiny" onClick={() => prefixLine('• ')}>فهرست</button>
          <button type="button" className="btn-tiny" onClick={() => prefixLine('— ')}>بند</button>
        </div>
        <textarea
          ref={editorRef}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          rows={14}
          className="field-input min-h-[280px] resize-y leading-8"
          placeholder="پیش‌نویس نامه، صورت‌جلسه یا گزارش را اینجا بنویسید یا از پاسخ ابزار هوش مصنوعی جای‌گذاری کنید…"
          aria-label="ویرایشگر متن پیش‌نویس"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={!draft.trim()} onClick={() => void copyDraft()}>
            <Clipboard size={15} /> {copied ? 'کپی شد' : 'کپی متن نهایی'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={!draft.trim()} onClick={printDraft}>
            چاپ پیش‌نویس
          </button>
          <button type="button" className="btn btn-secondary" disabled={!draft} onClick={() => setDraft('')}>پاک‌کردن ویرایشگر</button>
        </div>
      </div>
      <p className="text-[11px] text-ink-500">تولید خودکار متن با مدل هوش مصنوعی هنوز به اتصال سرویس جداگانه نیاز دارد؛ این ویرایشگر امکان نوشتن، اصلاح و آماده‌سازی خروجی را داخل سامانه فراهم می‌کند.</p>
    </section>
  );
}
