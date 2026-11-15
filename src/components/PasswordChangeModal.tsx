import { useState, type FormEvent } from 'react';
import { KeyRound, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { onClose: () => void };

export default function PasswordChangeModal({ onClose }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError('رمز جدید باید حداقل ۸ نویسه باشد.');
      return;
    }
    if (password !== confirmation) {
      setError('تکرار رمز عبور با رمز جدید یکسان نیست.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError('تغییر رمز انجام نشد. دوباره وارد سامانه شوید و تلاش کنید.');
      return;
    }
    setSaved(true);
    setPassword('');
    setConfirmation('');
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/45 p-4" onClick={() => !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="password-change-title" className="panel w-full max-w-[420px]" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 id="password-change-title" className="font-bold">تغییر رمز عبور</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} aria-label="بستن">
            <X size={16} />
          </button>
        </div>
        {saved ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-brand-700">رمز عبور با موفقیت تغییر کرد.</p>
            <button type="button" className="btn" onClick={onClose}>بستن</button>
          </div>
        ) : (
          <form onSubmit={event => void submit(event)} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-xs text-ink-600">
              رمز عبور جدید
              <input type="password" dir="ltr" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="field-input" />
            </label>
            <label className="flex flex-col gap-2 text-xs text-ink-600">
              تکرار رمز عبور جدید
              <input type="password" dir="ltr" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="field-input" />
            </label>
            {error && <p className="text-sm text-error-500">{error}</p>}
            <button type="submit" className="btn mt-2" disabled={busy}>
              <KeyRound size={16} />
              {busy ? 'در حال ذخیره…' : 'ثبت رمز جدید'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
