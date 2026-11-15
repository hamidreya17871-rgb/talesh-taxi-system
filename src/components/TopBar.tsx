import { KeyRound, LogOut, Menu, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PasswordChangeModal from '@/components/PasswordChangeModal';
import { ROLE_LABELS, type Profile } from '@/lib/staff';

type TopBarProps = {
  title: string;
  profile: Profile;
  onSignOut: () => void;
  onMenuClick: () => void;
  onMessagesClick: () => void;
};

export default function TopBar({ title, profile, onSignOut, onMenuClick, onMessagesClick }: TopBarProps) {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (profile.role !== 'driver' || !profile.driver_id) {
      setUnreadMessages(0);
      return;
    }
    let active = true;
    const loadUnread = async () => {
      const { data, error } = await supabase.rpc('get_unread_driver_message_count');
      if (!active || error || typeof data !== 'number') return;
      setUnreadMessages(data);
    };
    void loadUnread();
    const channel = supabase
      .channel(`driver-message-alerts:${profile.user_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_messages' }, () => void loadUnread())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'driver_message_reads',
        filter: `driver_id=eq.${profile.driver_id}`,
      }, () => void loadUnread())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [profile.driver_id, profile.role, profile.user_id]);
  return (
    <header className="flex h-[75px] items-center justify-between gap-3 border-b border-ink-200 bg-white px-7 max-[650px]:h-16 max-[650px]:px-4">
      <div>
        <h1 className="text-lg font-bold text-ink-900 max-[650px]:text-sm">{title}</h1>
        <p className="text-xs text-ink-600 max-[650px]:hidden">سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش</p>
      </div>
      <div className="flex items-center gap-2.5">
        {profile.role === 'driver' && (
          <button type="button" className="btn-tiny relative" onClick={onMessagesClick} aria-label={unreadMessages > 0 ? `${unreadMessages} پیام خوانده‌نشده` : 'پیام‌ها'}>
            <MessageSquare size={15} />
            پیام‌ها
            {unreadMessages > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{unreadMessages > 99 ? '۹۹+' : unreadMessages.toLocaleString('fa-IR')}</span>}
          </button>
        )}
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
        <button type="button" className="btn-tiny" onClick={() => setPasswordModalOpen(true)} aria-label="تغییر رمز عبور">
          <KeyRound size={13} />
          رمز
        </button>
        <button type="button" className="btn-tiny" onClick={onSignOut} aria-label="خروج از حساب">
          <LogOut size={13} />
          خروج
        </button>
      </div>
      {passwordModalOpen && <PasswordChangeModal onClose={() => setPasswordModalOpen(false)} />}
    </header>
  );
}
