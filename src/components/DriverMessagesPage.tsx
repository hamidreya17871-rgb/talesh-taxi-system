import { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMessageDateTime, type DriverMessage } from '@/lib/messages';

const LOAD_ERROR = 'پیام‌ها دریافت نشد. لطفاً دوباره تلاش کنید.';

type MessageWithReadState = DriverMessage & { isRead: boolean; isExpanded: boolean };

type Props = { driverId: string | null };

export default function DriverMessagesPage({ driverId }: Props) {
  const [messages, setMessages] = useState<MessageWithReadState[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    if (!driverId) {
      setMessages([]);
      setLoadError('پرونده راننده به حساب کاربری متصل نیست؛ با مدیر سازمان تماس بگیرید.');
      return;
    }
    const [messagesResult, readsResult] = await Promise.all([
      supabase
        .from('driver_messages')
        .select('id, body, created_at, recipient_driver_id, drivers(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('driver_message_reads')
        .select('message_id')
        .eq('driver_id', driverId),
    ]);
    if (messagesResult.error || readsResult.error || !Array.isArray(messagesResult.data)) {
      setLoadError(LOAD_ERROR);
      return;
    }
    const readIds = new Set((readsResult.data ?? []).map(row => row.message_id));
    setMessages((messagesResult.data as DriverMessage[]).map(message => ({
      ...message,
      isRead: readIds.has(message.id),
      isExpanded: false,
    })));
  }, [driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openMessage(message: MessageWithReadState) {
    setMessages(current => current?.map(item => item.id === message.id ? { ...item, isExpanded: true } : item) ?? null);
    if (message.isRead || !driverId) return;
    setBusyId(message.id);
    const { error } = await supabase.from('driver_message_reads').insert({
      message_id: message.id,
      driver_id: driverId,
    });
    setBusyId(null);
    if (error && error.code !== '23505') {
      setLoadError('ثبت مشاهده پیام انجام نشد. دوباره تلاش کنید.');
      return;
    }
    setMessages(current => current?.map(item => item.id === message.id ? { ...item, isRead: true } : item) ?? null);
  }

  const unreadCount = (messages ?? []).filter(message => !message.isRead).length;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">پیام‌ها</h2>
          <p className="mt-1 text-sm text-ink-600">پیام‌های مدیریت و کارشناسان؛ اعلان تا زمان بازکردن هر پیام باقی می‌ماند.</p>
          {unreadCount > 0 && <p className="mt-1 text-xs font-bold text-brand-700">{unreadCount} پیام خوانده‌نشده</p>}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          <RefreshCw size={16} />
          به‌روزرسانی
        </button>
      </header>

      {messages === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}

      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {messages && messages.length === 0 && (
        <div className="panel flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-brand-50 text-brand-600">
            <Inbox size={22} />
          </span>
          <p className="text-ink-600">پیامی دریافت نکرده‌اید.</p>
        </div>
      )}

      {messages && messages.length > 0 && (
        <div className="flex flex-col gap-4">
          {messages.map(message => (
            <article key={message.id} className={`panel flex flex-col gap-3 ${!message.isRead ? 'border-brand-300' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-3 py-1 text-xs ${!message.isRead ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'}`}>
                  {!message.isRead ? 'جدید · بازنشده' : message.recipient_driver_id ? 'پیام شخصی' : 'برای همه رانندگان'}
                </span>
                <time className="text-xs text-ink-600">{formatMessageDateTime(message.created_at)}</time>
              </div>
              {message.isExpanded ? (
                <>
                  <p className="whitespace-pre-line text-sm leading-[1.7]">{message.body}</p>
                  <div className="flex items-center gap-2 text-xs text-brand-700">
                    <Check size={14} />
                    پیام مشاهده شد
                  </div>
                  <button type="button" className="btn-tiny self-start" onClick={() => setMessages(current => current?.map(item => item.id === message.id ? { ...item, isExpanded: false } : item) ?? null)}>
                    بستن پیام
                  </button>
                </>
              ) : (
                <>
                  <p className="line-clamp-2 text-sm leading-[1.5] text-ink-600">{message.body}</p>
                  <button
                    type="button"
                    className="btn-tiny self-start"
                    disabled={busyId === message.id}
                    onClick={() => void openMessage(message)}
                  >
                    {busyId === message.id ? 'در حال ثبت مشاهده…' : 'بازکردن پیام'}
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
