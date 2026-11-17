import { Bell, LogOut, Menu, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type Profile } from '@/lib/staff';

type StaffNotification = { id: string; title: string; body: string; created_at: string; read_at: string | null };

type TopBarProps = {
  title: string;
  profile: Profile;
  onSignOut: () => void;
  onMenuClick: () => void;
  onMessagesClick: () => void;
  onSecretariatClick: () => void;
};

export default function TopBar({ title, profile, onSignOut, onMenuClick, onMessagesClick, onSecretariatClick }: TopBarProps) {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  useEffect(() => {
    if (profile.role === 'driver') return;
    let active = true;
    const loadNotifications = async () => {
      const { data, error } = await supabase.from('staff_notifications')
        .select('id, title, body, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(12);
      if (!active || error) return;
      setNotifications((data ?? []) as StaffNotification[]);
    };
    void loadNotifications();
    const channel = supabase
      .channel(`staff-notifications:${profile.user_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_notifications', filter: `user_id=eq.${profile.user_id}` }, () => void loadNotifications())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [profile.role, profile.user_id]);

  async function openNotification(notification: StaffNotification) {
    if (!notification.read_at) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('staff_notifications').update({ read_at: now }).eq('id', notification.id);
      if (!error) setNotifications(items => items.map(item => item.id === notification.id ? { ...item, read_at: now } : item));
    }
    setNotificationsOpen(false);
    onSecretariatClick();
  }

  const unreadNotificationCount = notifications.filter(item => !item.read_at).length;

  return (
    <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 border-b border-ink-200/80 bg-white/95 px-7 shadow-[0_2px_12px_#163c3208] backdrop-blur max-[650px]:h-16 max-[650px]:px-3">
      <button type="button" className="btn-tiny shrink-0" onClick={onMenuClick} aria-label="باز کردن منوی اصلی"><Menu size={20}/><span className="max-[650px]:hidden">منو</span></button>
      <div className="flex min-w-0 items-center gap-3">
        <img src="/icons/icon-512.png" alt="نشان رسمی تاکسیرانی تالش" className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-sm" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-ink-900 max-[650px]:text-sm">{title}</h1>
          <p className="text-xs text-ink-600 max-[650px]:hidden">سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {profile.role === 'driver' && (
          <button type="button" className="btn-tiny relative" onClick={onMessagesClick} aria-label={unreadMessages > 0 ? `${unreadMessages} پیام خوانده‌نشده` : 'پیام‌ها'}>
            <MessageSquare size={15} />
            <span className="max-[650px]:hidden">پیام‌ها</span>
            {unreadMessages > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{unreadMessages > 99 ? '۹۹+' : unreadMessages.toLocaleString('fa-IR')}</span>}
          </button>
        )}
        {profile.role !== 'driver' && (
          <div className="relative">
            <button type="button" className="btn-tiny relative" onClick={() => setNotificationsOpen(open => !open)} aria-label={unreadNotificationCount ? `${unreadNotificationCount} اعلان خوانده‌نشده` : 'اعلان‌ها'}>
              <Bell size={15} />
              <span className="max-[650px]:hidden">اعلان‌ها</span>
              {unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{unreadNotificationCount > 99 ? '۹۹+' : unreadNotificationCount.toLocaleString('fa-IR')}</span>}
            </button>
            {notificationsOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-[min(360px,90vw)] rounded-xl border border-ink-200 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold text-sm">اعلان‌های دبیرخانه</p>
                  <button type="button" className="text-xs text-ink-500" onClick={() => setNotificationsOpen(false)}>بستن</button>
                </div>
                {notifications.length === 0 ? <p className="py-5 text-center text-xs text-ink-500">اعلانی وجود ندارد.</p> : (
                  <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
                    {notifications.map(notification => (
                      <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`rounded-lg border p-3 text-right ${notification.read_at ? 'border-ink-100 bg-white' : 'border-gold-200 bg-gold-50'}`}>
                        <span className="block text-xs font-bold">{notification.title}</span>
                        <span className="mt-1 block text-xs text-ink-600">{notification.body}</span>
                        <span className="mt-1 block text-[10px] text-ink-500">{new Date(notification.created_at).toLocaleString('fa-IR')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div title="پروفایل کاربری" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-100 bg-brand-50 font-bold text-brand-700">{profile.full_name.charAt(0)}</div>
        <div className="text-[13px] leading-[1.6] max-[650px]:hidden">
          <p className="font-bold">{profile.full_name}</p>
          <p className="text-xs text-ink-600">{ROLE_LABELS[profile.role]}</p>
        </div>
        <button type="button" className="btn-tiny" onClick={onSignOut} aria-label="خروج از حساب">
          <LogOut size={13} />
          <span className="max-[650px]:hidden">خروج</span>
        </button>
      </div>
    </header>
  );
}
