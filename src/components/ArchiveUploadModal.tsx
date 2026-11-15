import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Upload, X } from 'lucide-react';
import {
  ARCHIVE_BUCKET,
  ARCHIVE_CATEGORIES,
  ARCHIVE_CATEGORY_LABELS,
  archiveFileExtension,
  validateArchiveFile,
  type ArchiveCategory,
} from '@/lib/archive';
import { supabase } from '@/lib/supabase';

export type ArchiveOwnerOption = { id: string; label: string };

type Props = {
  defaultCategory: ArchiveCategory;
  allowedCategories?: ArchiveCategory[];
  drivers: ArchiveOwnerOption[];
  vehicles: ArchiveOwnerOption[];
  onClose: () => void;
  onSaved: () => void;
};

const SAVE_ERROR = 'ذخیره مدرک انجام نشد. لطفاً دوباره تلاش کنید.';

export default function ArchiveUploadModal({ defaultCategory, allowedCategories = [...ARCHIVE_CATEGORIES], drivers, vehicles, onClose, onSaved }: Props) {
  const [category, setCategory] = useState<ArchiveCategory>(defaultCategory);
  const [ownerId, setOwnerId] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ownerOptions = category === 'driver' ? drivers : category === 'vehicle' ? vehicles : [];
  const needsOwner = category === 'driver' || category === 'vehicle';

  useEffect(() => {
    setOwnerId('');
  }, [category]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError('عنوان مدرک را وارد کنید.');
      return;
    }
    if (needsOwner && !ownerId) {
      setError(category === 'driver' ? 'لطفاً راننده را انتخاب کنید.' : 'لطفاً خودرو را انتخاب کنید.');
      return;
    }
    const fileError = validateArchiveFile(file);
    if (fileError || !file) {
      setError(fileError);
      return;
    }
    const extension = archiveFileExtension(file);
    if (!extension) return;

    setBusy(true);
    setError(null);
    const filePath = `${category}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setError(SAVE_ERROR);
      setBusy(false);
      return;
    }

    const { error: saveError } = await supabase.from('archive_documents').insert({
      category,
      driver_id: category === 'driver' ? ownerId : null,
      vehicle_id: category === 'vehicle' ? ownerId : null,
      title: title.trim(),
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type,
    });
    if (saveError) {
      await supabase.storage.from(ARCHIVE_BUCKET).remove([filePath]);
      setError(SAVE_ERROR);
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-[18px]" onClick={() => !busy && onClose()}>
      <div className="panel w-full max-w-[520px] max-h-[90vh] animate-pop-in overflow-y-auto" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">افزودن مدرک</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="archive-category" className="text-xs text-ink-600">بایگانی</label>
            <select id="archive-category" value={category} onChange={e => setCategory(e.target.value as ArchiveCategory)} className="field-input">
              {allowedCategories.map(item => (
                <option key={item} value={item}>{ARCHIVE_CATEGORY_LABELS[item]}</option>
              ))}
            </select>
          </div>

          {needsOwner && (
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="archive-owner" className="text-xs text-ink-600">
                {category === 'driver' ? 'راننده' : 'خودرو'}
              </label>
              <select id="archive-owner" value={ownerId} onChange={e => setOwnerId(e.target.value)} className="field-input">
                <option value="">انتخاب کنید</option>
                {ownerOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="archive-title" className="text-xs text-ink-600">عنوان مدرک</label>
            <input id="archive-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className="field-input" />
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="archive-file" className="text-xs text-ink-600">فایل اسکن شده (PDF، JPG یا PNG، حداکثر ۱۰ مگابایت)</label>
            <input
              id="archive-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
              className="field-input"
            />
          </div>

          {error && <p className="text-sm text-error-500">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" className="btn" disabled={busy}>
              <Upload size={16} />
              {busy ? 'در حال بارگذاری…' : 'بارگذاری و ذخیره'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
