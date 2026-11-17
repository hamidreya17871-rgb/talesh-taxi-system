import { useEffect, useState } from 'react';
import { Camera, Download, FileText, Image as ImageIcon, Paperclip, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const BUCKET = 'archive-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type AttachmentRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

type DisplayAttachment = AttachmentRow & { signedUrl: string | null };

type Props = {
  letterId: string | null;
  queuedFiles: File[];
  onQueuedFilesChange: (files: File[]) => void;
  canUpload: boolean;
};

async function getAllowedMime(file: File): Promise<string | null> {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return null;
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const has = (signature: number[], offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value);

  if (bytes.some((_, index) => has([0x25, 0x50, 0x44, 0x46, 0x2d], index))) return 'application/pdf';
  if (has([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (has([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  return null;
}

export async function uploadLetterAttachments(letterId: string, files: File[]) {
  const failedFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const mimeType = await getAllowedMime(file);
    if (!mimeType || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      failedFiles.push(file);
      errors.push(`${file.name}: نوع یا حجم فایل مجاز نیست.`);
      continue;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'document';
    const path = `letters/${letterId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: mimeType,
      cacheControl: '60',
      upsert: false,
    });

    if (uploadError) {
      failedFiles.push(file);
      errors.push(`${file.name}: بارگذاری فایل ناموفق بود.`);
      continue;
    }

    const { error: rowError } = await supabase.from('letter_attachments').insert({
      letter_id: letterId,
      storage_path: path,
      file_name: file.name,
      mime_type: mimeType,
      file_size: file.size,
    });

    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path]);
      failedFiles.push(file);
      errors.push(`${file.name}: ثبت مشخصات پیوست ناموفق بود.`);
    }
  }

  return { failedFiles, errors };
}

export default function LetterAttachments({ letterId, queuedFiles, onQueuedFilesChange, canUpload }: Props) {
  const [attachments, setAttachments] = useState<DisplayAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (!letterId) {
      setAttachments([]);
      return () => { active = false; };
    }

    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('letter_attachments')
        .select('id, storage_path, file_name, mime_type, file_size, created_at')
        .eq('letter_id', letterId)
        .order('created_at', { ascending: true });

      if (!active) return;
      if (error || !data) {
        setMessage('دریافت فهرست پیوست‌ها انجام نشد.');
        setLoading(false);
        return;
      }

      const rows = data as AttachmentRow[];
      const withUrls = await Promise.all(rows.map(async row => {
        const { data: signed, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 900);
        return { ...row, signedUrl: signedError ? null : signed?.signedUrl ?? null };
      }));

      if (active) {
        setAttachments(withUrls);
        setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [letterId]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = Array.from(fileList);
    const checked = await Promise.all(next.map(async file => ({
      file,
      mimeType: await getAllowedMime(file),
    })));
    const valid = checked.filter(item => item.mimeType !== null).map(item => item.file);
    if (valid.length !== next.length) {
      setMessage('فقط PDF، JPG یا PNG واقعی تا حجم ۱۰ مگابایت پذیرفته می‌شود.');
    }
    if (attachments.length + queuedFiles.length + valid.length > 20) {
      setMessage('برای هر نامه حداکثر ۲۰ پیوست مجاز است.');
      return;
    }
    if (valid.length) {
      onQueuedFilesChange([...queuedFiles, ...valid]);
      if (valid.length === next.length) setMessage('');
    }
  }

  return (
    <section className="rounded-xl border border-ink-200 p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 font-bold text-sm">
        <Paperclip size={16} />
        اسکن و پیوست اسناد
      </div>

      {canUpload && (
        <>
          <p className="text-xs leading-6 text-ink-600">
            با گوشی هر صفحه را جداگانه عکس بگیرید و «افزودن صفحه بعد» را بزنید. با کامپیوتر، فایل PDF یا تصویر خروجی اسکنر را انتخاب کنید.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-secondary cursor-pointer">
              <Camera size={16} />
              عکس‌برداری / افزودن صفحه
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="hidden"
                onChange={event => { addFiles(event.target.files); event.currentTarget.value = ''; }}
              />
            </label>
            <label className="btn btn-secondary cursor-pointer">
              <Upload size={16} />
              انتخاب PDF یا تصویر
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={event => { addFiles(event.target.files); event.currentTarget.value = ''; }}
              />
            </label>
          </div>
          {queuedFiles.length > 0 && (
            <div className="rounded-lg bg-ink-50 p-2 flex flex-col gap-2">
              <p className="text-xs font-bold">فایل‌های آماده بارگذاری ({queuedFiles.length})</p>
              {queuedFiles.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">{file.name}</span>
                  <button type="button" className="btn-tiny btn-tiny-danger shrink-0" onClick={() => onQueuedFilesChange(queuedFiles.filter((_, i) => i !== index))}>حذف</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {loading && <p className="text-xs text-ink-500">در حال دریافت پیوست‌ها…</p>}
      {message && <p className="text-xs text-error-500">{message}</p>}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold">اسناد ثبت‌شده ({attachments.length})</p>
          {attachments.map(item => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-100 p-2">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                {item.mime_type === 'application/pdf' ? <FileText size={17} /> : <ImageIcon size={17} />}
                <span className="truncate">{item.file_name}</span>
                <span className="shrink-0 text-ink-500">{(item.file_size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              {item.signedUrl ? (
                <div className="flex gap-2">
                  <a className="btn-tiny" href={item.signedUrl} target="_blank" rel="noreferrer">مشاهده / چاپ</a>
                  <a className="btn-tiny" href={item.signedUrl} download={item.file_name}>
                    <Download size={13} />
                    دریافت
                  </a>
                </div>
              ) : <span className="text-xs text-error-500">دسترسی فایل ممکن نیست</span>}
            </div>
          ))}
        </div>
      )}
      {!loading && attachments.length === 0 && letterId && <p className="text-xs text-ink-500">برای این نامه هنوز سندی ثبت نشده است.</p>}
    </section>
  );
}
