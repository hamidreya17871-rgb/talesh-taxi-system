import { useState } from 'react';
import { CalendarDays, CheckCircle2, KeyRound, PenLine, Phone, ShieldCheck, UserRound } from 'lucide-react';
import PasswordChangeModal from '@/components/PasswordChangeModal';
import ProfileSignatureModal from '@/components/ProfileSignatureModal';
import { formatPersianDate } from '@/lib/format';
import { ROLE_LABELS, type Profile } from '@/lib/staff';

type Props = { profile: Profile };

export default function ProfilePage({ profile }: Props) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signature, setSignature] = useState(profile.signature_data_url ?? '');

  const details = [
    { label: 'نام و نام خانوادگی', value: profile.full_name, icon: UserRound },
    { label: 'شماره همراه', value: profile.phone || 'ثبت نشده', icon: Phone },
    { label: 'نقش کاربری', value: ROLE_LABELS[profile.role], icon: ShieldCheck },
    { label: 'وضعیت حساب', value: profile.is_active && profile.approval_status === 'approved' ? 'فعال و تأییدشده' : 'نیازمند بررسی', icon: CheckCircle2 },
    { label: 'تاریخ ایجاد حساب', value: formatPersianDate(profile.created_at), icon: CalendarDays },
  ];

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5" dir="rtl">
      <header className="rounded-2xl border border-brand-100 bg-gradient-to-l from-white to-brand-50 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-800"><UserRound size={27}/></span>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-brand-900">پروفایل کاربری</h2>
            <p className="mt-1 text-sm text-ink-600">{profile.full_name} · {ROLE_LABELS[profile.role]}</p>
          </div>
        </div>
      </header>

      <section className="panel p-5">
        <h3 className="mb-4 font-bold">مشخصات حساب</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700"><Icon size={18}/></span>
              <div className="min-w-0"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>
            </div>
          ))}
          {profile.role === 'driver' && profile.driver_id && (
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3"><p className="text-xs text-ink-500">شناسه پرونده راننده</p><p className="mt-1 break-all text-xs font-semibold" dir="ltr">{profile.driver_id}</p></div>
          )}
        </div>
      </section>

      <section className="panel flex flex-col gap-3 p-5">
        <div><h3 className="font-bold">امنیت حساب</h3><p className="mt-1 text-sm text-ink-600">برای حفظ امنیت، رمز عبور خود را محرمانه نگه دارید و در صورت نیاز از این قسمت تغییر دهید.</p></div>
        <button type="button" className="btn self-start" onClick={() => setPasswordOpen(true)}><KeyRound size={16}/> تغییر رمز عبور</button>
      </section>

      {profile.role === 'manager' && (
        <section className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-bold">امضای مدیر سازمان</h3><p className="mt-1 text-sm text-ink-600">امضای ذخیره‌شده برای اسناد و نامه‌های رسمی پس از تأیید مدیر استفاده می‌شود.</p></div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><PenLine size={19}/></span>
          </div>
          {signature ? <img src={signature} alt="امضای ذخیره‌شده مدیر" className="max-h-24 max-w-[260px] rounded-lg border border-ink-100 bg-white object-contain p-2"/> : <p className="rounded-lg bg-gold-50 p-3 text-sm text-gold-800">هنوز امضایی ثبت نشده است.</p>}
          <button type="button" className="btn self-start" onClick={() => setSignatureOpen(true)}><PenLine size={16}/>{signature ? 'طراحی یا تغییر امضا' : 'طراحی و ثبت امضا'}</button>
        </section>
      )}

      {passwordOpen && <PasswordChangeModal onClose={() => setPasswordOpen(false)} />}
      {signatureOpen && <ProfileSignatureModal profile={{ ...profile, signature_data_url: signature }} onClose={() => setSignatureOpen(false)} onSaved={setSignature}/>}
    </section>
  );
}
