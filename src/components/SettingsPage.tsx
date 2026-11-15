import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import Notice from '@/components/Notice';

type SettingsPageProps = {
  onBackup: () => void;
  onRestore: (file: File) => void;
  onClearAll: () => void;
};

export default function SettingsPage({ onBackup, onRestore, onClearAll }: SettingsPageProps) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <>
      <div className="mb-[23px]">
        <h2 className="mb-2 text-[22px] font-bold">تنظیمات و پشتیبان‌گیری</h2>
        <p className="text-ink-600">مدیریت فایل پشتیبان اطلاعات سامانه</p>
      </div>

      <div className="grid grid-cols-2 gap-[17px] max-[1000px]:grid-cols-1">
        <section className="panel">
          <h3 className="mb-2 text-base font-bold">پشتیبان‌گیری از اطلاعات</h3>
          <p className="mb-4 text-ink-600">
            یک فایل JSON شامل رانندگان، خودروها، مجوزها، مدارک، یادآوری‌ها و تخلفات ذخیره می‌شود.
          </p>
          <button type="button" className="btn" onClick={onBackup}>
            <Download size={16} />
            دریافت نسخه پشتیبان
          </button>

          <hr className="my-[22px] border-ink-200" />

          <h3 className="mb-2 text-base font-bold">بازیابی اطلاعات</h3>
          <p className="mb-4 text-ink-600">
            فایل پشتیبان قبلی را انتخاب کنید. اطلاعات فعلی با اطلاعات فایل جایگزین می‌شود.
          </p>
          <input
            type="file"
            accept=".json,application/json"
            onChange={event => setFile(event.target.files?.[0] ?? null)}
            className="mb-4 block w-full text-sm"
          />
          <button type="button" className="btn btn-secondary" disabled={!file} onClick={() => file && onRestore(file)}>
            بازیابی فایل
          </button>
        </section>

        <section className="panel">
          <h3 className="mb-2 text-base font-bold">وضعیت سامانه</h3>
          <Notice title="ذخیره‌سازی ابری" detail="اطلاعات روی سرور ذخیره می‌شوند و از هر دستگاهی در دسترس است." />
          <Notice title="پشتیبان‌گیری دوره‌ای" detail="بهتر است هفته‌ای یک بار فایل پشتیبان دریافت و نگهداری کنید." />
          <button type="button" className="btn btn-danger mt-5" onClick={onClearAll}>
            <Trash2 size={16} />
            پاک‌کردن همه اطلاعات
          </button>
        </section>
      </div>
    </>
  );
}
