import { useState, type FormEvent } from 'react';
import { Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MESSAGE_MAX_LENGTH } from '@/lib/messages';
import type { FleetRecord } from '@/lib/fleetConfig';

type Props = {
  drivers: FleetRecord[];
  onSaved: () => void;
  onClose: () => void;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const ALL_DRIVERS = '';
const GENERIC_ERROR = 'ارسال پیام انجام نشد. لطفاً دوباره تلاش کنید.';

export default function MessageComposeModal({ drivers, onSaved, onClose, onNotify }: Props) {
  const [recipient, setRecipient] = useState(ALL_DRIVERS);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = body.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) {
      setError('متن پیام را وارد کنید.');
      return;
    }
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      setError(`متن پیام نباید بیش از ${MESSAGE_MAX_LENGTH} نویسه باشد.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from('driver_messages').insert({
      recipient_driver_id: recipient === ALL_DRIVERS ? null : recipient,
      body: trimmed,
    });
    if (insertError) {
      setError(GENERIC_ERROR);
      setBusy(false);
      return;
    }
    onNotify(recipient === ALL_DRIVERS ? 'پیام برای همه رانندگان ارسال شد' : 'پیام ارسال شد');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-[18px]" onClick={() => !busy && onClose()}>
      <div className="panel w-full max-w-[460px] animate-pop-in" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">ارسال پیام به رانندگان</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="message-recipient" className="text-xs text-ink-600">گیرنده</label>
            <select id="message-recipient" value={recipient} onChange={e => setRecipient(e.target.value)} className="field-input">
              <option value={ALL_DRIVERS}>همه رانندگان</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {String(driver.name ?? 'بدون نام')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="message-body" className="text-xs text-ink-600">متن پیام</label>
            <textarea
              id="message-body"
              rows={5}
              value={body}
              maxLength={MESSAGE_MAX_LENGTH}
              onChange={e => setBody(e.target.value)}
              className="field-input"
            />
            <span className="self-end text-xs text-ink-600">
              {trimmed.length.toLocaleString('fa-IR')} / {MESSAGE_MAX_LENGTH.toLocaleString('fa-IR')}
            </span>
          </div>
          {error && <p className="text-sm text-error-500">{error}</p>}
          <button type="submit" className="btn mt-2" disabled={busy}>
            <Send size={16} />
            {busy ? 'لطفاً صبر کنید…' : 'ارسال پیام'}
          </button>
        </form>
      </div>
    </div>
  );
}
