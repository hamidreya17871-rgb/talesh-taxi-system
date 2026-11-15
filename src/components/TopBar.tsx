import { LogOut, Menu } from 'lucide-react';
import { ROLE_LABELS, type Profile } from '@/lib/staff';

type TopBarProps = {
  title: string;
  profile: Profile;
  onSignOut: () => void;
  onMenuClick: () => void;
};

export default function TopBar({ title, profile, onSignOut, onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-[75px] items-center justify-between gap-3 border-b border-ink-200 bg-white px-7 max-[650px]:h-16 max-[650px]:px-4">
      <div>
        <h1 className="text-lg font-bold text-ink-900 max-[650px]:text-sm">{title}</h1>
        <p className="text-xs text-ink-600 max-[650px]:hidden">سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش</p>
      </div>
      <div className="flex items-center gap-2.5">
        <button type="button" className="btn-tiny" onClick={onMenuClick} aria-label="باز کردن منوی کناری">
          <Menu size={17} />
          منو
        </button>
        <div className="grid h-[39px] w-[39px] place-items-center rounded-full bg-brand-100 font-bold text-brand-600">
          {profile.full_name.charAt(0)}
        </div>
        <div className="text-[13px] leading-[1.6] max-[650px]:hidden">
          <p className="font-bold">{profile.full_name}</p>
          <p className="text-xs text-ink-600">{ROLE_LABELS[profile.role]}</p>
        </div>
        <button type="button" className="btn-tiny" onClick={onSignOut} aria-label="خروج از حساب">
          <LogOut size={13} />
          خروج
        </button>
      </div>
    </header>
  );
}
