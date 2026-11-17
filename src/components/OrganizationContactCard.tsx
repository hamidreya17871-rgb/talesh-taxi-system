import { MapPin, PhoneCall } from 'lucide-react';

const OFFICE_PHONE = '01344236535';
const OFFICE_PHONE_DISPLAY = '۰۱۳-۴۴۲۳۶۵۳۵';
const OFFICE_ADDRESS = 'تالش، بلوار پردیسان، خیابان اندیشه، ساختمان آتش‌نشانی، ایستگاه شماره ۲، طبقه دوم';

export default function OrganizationContactCard() {
  return (
    <section className="panel flex flex-col gap-3 p-5" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="font-bold">تماس با ما</h3><p className="mt-1 text-xs text-ink-600">ارتباط مستقیم با سازمان مدیریت حمل‌ونقل شهرداری تالش</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><PhoneCall size={19}/></span>
      </div>
      <a href={`tel:${OFFICE_PHONE}`} className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-brand-800 hover:bg-brand-50">
        <PhoneCall size={18}/><span><span className="block text-xs text-ink-600">شماره تماس سازمان</span><strong dir="ltr">{OFFICE_PHONE_DISPLAY}</strong></span>
      </a>
      <div className="flex items-start gap-3 rounded-xl border border-ink-100 p-3">
        <MapPin size={18} className="mt-0.5 shrink-0 text-brand-700"/>
        <div><p className="text-xs text-ink-600">نشانی سازمان</p><p className="mt-1 text-sm leading-7">{OFFICE_ADDRESS}</p></div>
      </div>
    </section>
  );
}
