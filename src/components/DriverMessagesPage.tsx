import { useCallback, useEffect, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMessageDateTime, type DriverMessage } from '@/lib/messages';

const LOAD_ERROR = 'پیام‌ها دریافت نشد. لطفاً دوباره تلاش کنید.';

export default function DriverMessagesPage() {
  const [messages, setMessages] = useState<DriverMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from('driver_messages')
      .select('id, body, created_at, recipient_driver_id, drivers(name)')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) {
      setLoadError(LOAD_ERROR);
      return;
    }
    setMessages(data as DriverMessage[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">پیام‌ها</h2>
          <p className="mt-1 text-sm text-ink-600">پیام‌های ارسال‌شده از سوی مدیریت و کارشناسان</p>
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
            <article key={message.id} className="panel flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs ${message.recipient_driver_id ? 'bg-blue-50 text-blue-600' : 'bg-brand-50 text-brand-700'}`}
                >
                  {message.recipient_driver_id ? 'پیام شخصی' : 'برای همه رانندگان'}
                </span>
                <time className="text-xs text-ink-600">{formatMessageDateTime(message.created_at)}</time>
              </div>
              <p className="whitespace-pre-line text-sm leading-[1.5]">{message.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
