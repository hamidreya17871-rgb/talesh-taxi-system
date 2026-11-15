import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMessageDateTime, type DriverMessage } from '@/lib/messages';
import type { FleetRecord } from '@/lib/fleetConfig';
import MessageComposeModal from '@/components/MessageComposeModal';

type Props = {
  drivers: FleetRecord[];
  canDelete: boolean;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const LOAD_ERROR = 'پیام‌ها دریافت نشد. لطفاً دوباره تلاش کنید.';
const ACTION_ERROR = 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.';

export default function StaffMessagesPage({ drivers, canDelete, onNotify }: Props) {
  const [messages, setMessages] = useState<DriverMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function remove(message: DriverMessage) {
    if (!window.confirm('این پیام حذف شود؟')) return;
    setBusyId(message.id);
    const { error } = await supabase.from('driver_messages').delete().eq('id', message.id);
    setBusyId(null);
    if (error) {
      onNotify(ACTION_ERROR, 'error');
      return;
    }
    onNotify('پیام حذف شد');
    void load();
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">پیام به رانندگان</h2>
          <p className="mt-1 text-sm text-ink-600">پیام‌های ارسال‌شده به یک راننده یا همه رانندگان</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            به‌روزرسانی
          </button>
          <button type="button" className="btn" onClick={() => setComposing(true)}>
            <Plus size={16} />
            پیام جدید
          </button>
        </div>
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

      {messages && messages.length === 0 && <p className="py-16 text-center text-ink-600">هنوز پیامی ارسال نشده است.</p>}

      {messages && messages.length > 0 && (
        <div className="flex flex-col gap-4">
          {messages.map(message => (
            <article key={message.id} className="panel flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-ink-100 px-3 py-1 text-xs">
                  {message.recipient_driver_id ? `به: ${message.drivers?.[0]?.name ?? 'راننده'}` : 'به: همه رانندگان'}
                </span>
                <time className="text-xs text-ink-600">{formatMessageDateTime(message.created_at)}</time>
              </div>
              <p className="whitespace-pre-line text-sm leading-[1.5]">{message.body}</p>
              {canDelete && (
                <div className="flex gap-2">
                  <button type="button" className="btn-tiny btn-tiny-danger" disabled={busyId === message.id} onClick={() => void remove(message)}>
                    <Trash2 size={13} />
                    حذف
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {composing && (
        <MessageComposeModal
          drivers={drivers}
          onNotify={onNotify}
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            void load();
          }}
        />
      )}
    </section>
  );
}
