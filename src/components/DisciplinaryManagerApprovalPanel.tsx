import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

type PendingCase = {
  id: string;
  status: string;
  taxi_identifier: string;
  violation_type: string;
  reporter_name: string;
  accused_driver_name: string | null;
  description: string;
  settlement_note: string | null;
  committee_decision: string | null;
  committee_note: string | null;
  committee_decided_at: string | null;
};

const PENDING = [
  'در انتظار تأیید سازش توسط مدیر',
  'در انتظار دستور مدیر برای ارجاع',
  'رأی صادر شد - در انتظار تأیید مدیر',
];

export default function DisciplinaryManagerApprovalPanel({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<PendingCase[]>([]);
  const [orders, setOrders] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('line_violation_reports')
      .select('id,status,taxi_identifier,violation_type,reporter_name,accused_driver_name,description,settlement_note,committee_decision,committee_note,committee_decided_at')
      .in('status', PENDING)
      .order('created_at', { ascending: true });
    if (queryError) { setError('دریافت کارتابل دستورهای مدیر انجام نشد.'); return; }
    setError('');
    setItems((data ?? []) as PendingCase[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approve(item: PendingCase) {
    const order = orders[item.id]?.trim() ?? '';
    if (order.length < 5) { setError('شرح دستور مدیر حداقل باید ۵ نویسه باشد.'); return; }
    const now = new Date().toISOString();
    let patch: Record<string, string>;
    let successLabel: string;
    if (item.status === 'در انتظار تأیید سازش توسط مدیر') {
      patch = { status: 'مختومه', settlement_approved_by: profile.user_id, settlement_approved_at: now, settlement_order_note: order };
      successLabel = 'سازش تأیید و پرونده مختومه شد.';
    } else if (item.status === 'در انتظار دستور مدیر برای ارجاع') {
      patch = { status: 'ارجاع به کمیته انضباطی', referral_order_by: profile.user_id, referral_order_at: now, referral_order_note: order, committee_referred_at: now };
      successLabel = 'دستور ارجاع به کمیته صادر شد.';
    } else {
      patch = { status: 'تأیید نهایی رأی', verdict_approved_by: profile.user_id, verdict_approved_at: now, verdict_order_note: order };
      successLabel = 'رأی تأیید و دستور مدیر ثبت شد.';
    }
    setBusyId(item.id); setError('');
    const { data, error: updateError } = await supabase
      .from('line_violation_reports')
      .update(patch)
      .eq('id', item.id)
      .eq('status', item.status)
      .select('id')
      .maybeSingle();
    setBusyId(null);
    if (updateError || !data) {
      setError('ثبت دستور انجام نشد؛ ممکن است پرونده هم‌زمان توسط کاربر دیگری تغییر کرده باشد.');
      return;
    }
    setOrders(old => ({ ...old, [item.id]: '' }));
    await load();
    setError(successLabel);
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={19} className="text-brand-600" />
          <div>
            <h3 className="font-bold">کارتابل تأیید و دستور مدیر سازمان</h3>
            <p className="text-xs text-ink-600">هیچ ارجاع، مختومه‌سازی یا اجرای رأی بدون دستور ثبت‌شده مدیر نهایی نمی‌شود.</p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={15} /> تازه‌سازی</button>
      </div>
      {error && <p className="text-sm text-ink-600">{error}</p>}
      {items.length === 0 && <p className="text-sm text-ink-600">موردی در انتظار دستور مدیر نیست.</p>}
      {items.map(item => {
        const action = item.status === 'در انتظار تأیید سازش توسط مدیر'
          ? 'تأیید سازش و مختومه‌سازی'
          : item.status === 'در انتظار دستور مدیر برای ارجاع'
            ? 'صدور دستور ارجاع به کمیته'
            : 'تأیید نهایی رأی و صدور دستور اجرا';
        return (
          <article key={item.id} className="flex flex-col gap-3 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">{item.violation_type} · تاکسی {item.taxi_identifier}</strong>
              <span className="rounded-full bg-gold-100 px-3 py-1 text-xs">{item.status}</span>
            </div>
            <p className="text-xs text-ink-600">بازرس خط: {item.reporter_name} · راننده مورد گزارش: {item.accused_driver_name || 'نامشخص'}</p>
            <p className="whitespace-pre-wrap text-sm">{item.description}</p>
            {item.settlement_note && <p className="rounded-lg bg-ink-50 p-2 text-xs">گزارش سازش کارشناس: {item.settlement_note}</p>}
            {item.committee_decision && (
              <div className="rounded-lg bg-ink-50 p-3 text-sm">
                <strong>رأی کمیته: {item.committee_decision}</strong>
                {item.committee_note && <p className="mt-1 whitespace-pre-wrap">{item.committee_note}</p>}
                {item.committee_decided_at && <p className="mt-1 text-xs text-ink-500">زمان صدور رأی: {new Date(item.committee_decided_at).toLocaleString('fa-IR')}</p>}
              </div>
            )}
            <label className="flex flex-col gap-1 text-xs text-ink-600">متن دستور / مبنای تأیید مدیر
              <textarea rows={3} maxLength={3000} minLength={5} required value={orders[item.id] ?? ''} onChange={e => setOrders(old => ({ ...old, [item.id]: e.target.value }))} className="field-input" placeholder="دستور مدیر، مبنای تأیید و اقدام بعدی را بنویسید…" />
            </label>
            <button type="button" className="btn self-start" disabled={busyId === item.id} onClick={() => void approve(item)}>
              <CheckCheck size={15} /> {busyId === item.id ? 'در حال ثبت…' : action}
            </button>
          </article>
        );
      })}
      <p className="text-xs text-ink-500">ثبت کاربر تأییدکننده، زمان و متن دستور در سابقه پرونده نگهداری می‌شود. این ثبت، امضای الکترونیکی داخلی سامانه است و جایگزین گواهی امضای دیجیتال قانونی نیست.</p>
    </section>
  );
}
