import { useState } from 'react';
import { Archive, Bell, BusFront, Camera, CarTaxiFront, ClipboardList, FileText, LayoutDashboard, LockKeyhole, Search, Upload, Users } from 'lucide-react';

type DemoPage = 'dashboard' | 'drivers' | 'vehicles' | 'secretariat' | 'archive';

const nav: { key: DemoPage; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'drivers', label: 'رانندگان', icon: Users },
  { key: 'vehicles', label: 'خودروها', icon: BusFront },
  { key: 'secretariat', label: 'دبیرخانه', icon: ClipboardList },
  { key: 'archive', label: 'بایگانی و اسکن', icon: Archive },
];

const drivers = [
  ['۱', 'علی رضایی', '۰۹۱۱۱۲۳۴۵۶۷', 'فعال'],
  ['۲', 'محمد احمدی', '۰۹۱۱۲۲۲۳۳۴۴', 'فعال'],
  ['۳', 'حسین کریمی', '۰۹۱۱۳۳۳۴۴۵۵', 'در انتظار تمدید'],
];

export default function PreviewDemo() {
  const [page, setPage] = useState<DemoPage>('dashboard');
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState('');

  return (
    <div dir="rtl" className="min-h-screen bg-ink-100 text-ink-900">
      <div className="border-b border-gold-300 bg-brand-900 px-4 py-2 text-center text-xs font-bold text-white">
        نسخه آزمایشی — داده‌ها نمونه هستند و هیچ تغییری در اطلاعات اصلی ذخیره نمی‌شود.
      </div>
      <div className="flex min-h-[calc(100vh-36px)]">
        <aside className="hidden w-60 shrink-0 flex-col bg-brand-800 p-4 text-white md:flex">
          <div className="mb-8 flex items-center gap-3 border-b border-white/15 pb-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-400 text-brand-900"><CarTaxiFront size={24}/></span>
            <div><p className="font-extrabold">تاکسیرانی تالش</p><p className="text-xs text-brand-100">سامانه مدیریت</p></div>
          </div>
          <nav className="flex flex-col gap-2">
            {nav.map(item => {
              const Icon = item.icon;
              return <button key={item.key} onClick={() => setPage(item.key)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-right text-sm ${page === item.key ? 'bg-white/15 font-bold text-white' : 'text-brand-100 hover:bg-white/10'}`}><Icon size={18}/>{item.label}</button>;
            })}
          </nav>
          <div className="mt-auto rounded-xl border border-white/15 bg-white/5 p-3 text-xs leading-6 text-brand-100"><LockKeyhole size={16} className="mb-2"/>حالت امن پیش‌نمایش<br/>اتصال به پایگاه داده واقعی غیرفعال است.</div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-white/95 px-4 py-4 shadow-sm md:px-7">
            <div><h1 className="font-extrabold">{nav.find(item => item.key === page)?.label}</h1><p className="text-xs text-ink-600">سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش</p></div>
            <div className="flex items-center gap-2"><span className="rounded-full bg-gold-50 px-3 py-1.5 text-xs font-bold text-gold-700">نمایش آزمایشی</span><Bell size={18} className="text-ink-600"/></div>
          </header>
          <div className="mx-auto max-w-6xl p-4 md:p-7">
            <div className="mb-5 flex gap-2 overflow-x-auto md:hidden">
              {nav.map(item => <button key={item.key} onClick={() => setPage(item.key)} className={`shrink-0 rounded-full px-3 py-2 text-xs ${page === item.key ? 'bg-brand-700 text-white' : 'bg-white text-ink-700'}`}>{item.label}</button>)}
            </div>
            {page === 'dashboard' && <>
              <div className="mb-5 rounded-2xl border border-brand-100 bg-gradient-to-l from-white to-brand-50 p-5"><h2 className="text-xl font-extrabold text-brand-900">داشبورد مدیریت</h2><p className="mt-1 text-sm text-ink-600">نمای کلی وضعیت ناوگان و امور تاکسیرانی تالش</p></div>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[['رانندگان ثبت‌شده','۱۱'],['خودروهای فعال','۱۱'],['نامه‌های در جریان','۴'],['مدارک بایگانی','۸']].map(([label,value])=><div key={label} className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-600">{label}</p><p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p></div>)}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-ink-200 bg-white p-5"><h3 className="mb-3 font-bold">دسترسی سریع</h3><div className="grid grid-cols-2 gap-2">{nav.slice(1).map(item=><button key={item.key} onClick={()=>setPage(item.key)} className="rounded-xl border border-ink-200 p-4 text-right text-sm font-bold hover:border-brand-400 hover:bg-brand-50">{item.label}</button>)}</div></section>
                <section className="rounded-2xl border border-ink-200 bg-white p-5"><h3 className="mb-3 font-bold">وضعیت سامانه</h3><p className="text-sm leading-7 text-ink-600">نسخه آزمایشی برای بررسی چیدمان، مسیرهای دسترسی و تجربه کاربری فعال است. عملیات ثبت، ویرایش و حذف در این محیط غیرفعال است.</p><p className="mt-3 rounded-lg bg-brand-50 p-3 text-xs leading-6 text-brand-800">اطلاعات نمایشی نمونه هستند و از پایگاه داده اصلی خوانده نشده‌اند.</p></section>
              </div>
            </>}
            {page === 'drivers' && <section className="rounded-2xl border border-ink-200 bg-white p-4 md:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">فهرست رانندگان</h2><p className="text-xs text-ink-600">نمونه نمایشی — فقط مشاهده</p></div><div className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجو" className="w-28 text-sm outline-none"/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="bg-ink-50 text-ink-600"><tr><th className="p-3 text-right">ردیف</th><th className="p-3 text-right">نام راننده</th><th className="p-3 text-right">موبایل</th><th className="p-3 text-right">وضعیت</th></tr></thead><tbody>{drivers.filter(row=>row.join(' ').includes(query)).map(row=><tr key={row[0]} className="border-t border-ink-100"><td className="p-3">{row[0]}</td><td className="p-3 font-bold">{row[1]}</td><td className="p-3">{row[2]}</td><td className="p-3">{row[3]}</td></tr>)}</tbody></table></div></section>}
            {page === 'vehicles' && <section className="rounded-2xl border border-ink-200 bg-white p-5"><h2 className="font-bold">مدیریت ناوگان</h2><p className="mt-2 text-sm text-ink-600">نمای آزمایشی فهرست خودروها و وضعیت فعالیت ناوگان.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-600">خودروهای فعال</p><p className="mt-1 text-2xl font-extrabold">۱۱</p></div><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-600">نیازمند بررسی</p><p className="mt-1 text-2xl font-extrabold">۲</p></div></div></section>}
            {page === 'secretariat' && <section className="rounded-2xl border border-ink-200 bg-white p-5"><div className="flex items-center gap-2"><FileText size={20}/><h2 className="font-bold">دبیرخانه و گردش نامه‌ها</h2></div><p className="mt-2 text-sm leading-7 text-ink-600">در نسخه اصلی، ثبت نامه وارده و صادره، ارجاع به کارشناس، بررسی، تأیید مدیر و پیگیری مهلت پاسخ در این بخش انجام می‌شود.</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-600">نامه‌های وارده</p><p className="mt-1 text-xl font-extrabold">۳</p></div><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-600">نامه‌های صادره</p><p className="mt-1 text-xl font-extrabold">۱</p></div></div></section>}
            {page === 'archive' && <section className="rounded-2xl border border-ink-200 bg-white p-5"><div className="mb-3 flex items-center gap-2"><Archive size={20}/><h2 className="font-bold">بایگانی و اسکن اسناد</h2></div><p className="mb-4 text-sm leading-7 text-ink-600">در نسخه اصلی، امکان عکس‌برداری با دوربین گوشی و انتخاب PDF یا تصویر خروجی اسکنر رایانه وجود دارد. اینجا فقط انتخاب محلی فایل برای بررسی رابط کاربری فعال است؛ فایلی ارسال یا ذخیره نمی‌شود.</p><div className="flex flex-wrap gap-2"><label className="btn cursor-pointer"><Camera size={16}/>عکس‌برداری / افزودن صفحه<input className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={e=>setFiles(old=>[...old,...Array.from(e.target.files ?? [])])}/></label><label className="btn btn-secondary cursor-pointer"><Upload size={16}/>انتخاب فایل اسکنر یا PDF<input className="hidden" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple onChange={e=>setFiles(old=>[...old,...Array.from(e.target.files ?? [])])}/></label></div>{files.length>0&&<div className="mt-4 rounded-xl bg-ink-50 p-3"><p className="mb-2 text-sm font-bold">فایل‌های انتخاب‌شده ({files.length})</p>{files.map((file,i)=><div key={i} className="flex items-center justify-between gap-2 border-t border-ink-200 py-2 text-xs"><span className="truncate">{file.name}</span><button className="text-error-500" onClick={()=>setFiles(old=>old.filter((_,index)=>index!==i))}>حذف</button></div>)}</div>}</section>}
            <p className="mt-5 flex items-center gap-2 text-xs text-ink-600"><LockKeyhole size={14}/>حالت نمایشی امن؛ بدون اتصال به پایگاه داده و بدون ثبت اطلاعات</p>
          </div>
        </main>
      </div>
    </div>
  );
}
