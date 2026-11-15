import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Gavel } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/staff';

type CommitteeCase = {
  id: string;
  reporter_name: string;
  reporter_phone: string | null;
  accused_driver_name: string | null;
  taxi_identifier: string;
  violation_type: string;
  location: string;
  occurred_at: string | null;
  description: string;
  settlement_note: string | null;
  created_at: string;
};

const DECISIONS = ['عدم احراز تخلف', 'تذکر کتبی', 'اخطار رسمی', 'تعلیق موقت فعالیت', 'پیشنهاد لغو پروانه فعالیت', 'تکمیل تحقیقات و ارائه مستندات'];

export default function DisciplinaryCommitteePanel({ profile }: { profile: Profile }) {
  const [cases, setCases] = useState<CommitteeCase[]>([]);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('line_violation_reports')
      .select('*').eq('status', 'ارجاع به کمیته انضباطی')
      .order('committee_referred_at', { ascending: true });
    if (queryError) { setError('دریافت پرونده‌های کمیته انضباطی انجام نشد.'); return; }
    setError('');
    setCases((data ?? []) as CommitteeCase[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function issueVerdict(item: CommitteeCase) {
    const decision = decisions[item.id];
    if (!decision) { setError('ابتدا نوع رأی را انتخاب کنید.'); return; }
    setBusyId(item.id); setError('');
    const { error: updateError } = await supabase.from('line_violation_reports').update({
      committee_decision: decision,
      committee_note: notes[item.id]?.trim() || null,
      committee_decided_by: profile.user_id,
      committee_decided_at: new Date().toISOString(),
      status: 'رأی صادر شد - در انتظار تأیید مدیر',
    }).eq('id', item.id).eq('status', 'ارجاع به کمیته انضباطی');
    setBusyId(null);
    if (updateError) { setError('ثبت رأی انجام نشد. سطح دسترسی یا وضعیت پرونده را بررسی کنید.'); return; }
    await load();
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gavel size={19} className="text-brand-600" />
          <div>
            <h3 className="font-bold">کارتابل کمیته انضباطی</h3>
            <p className="text-xs text-ink-600">پرونده‌های ارجاع‌شده پس از عدم حصول سازش</p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={15} /> تازه‌سازی</button>
      </div>
      {error && <p className="text-sm text-error-500">{error}</p>}
      {cases.length === 0 && <p className="text-sm text-ink-600">پرونده ارجاع‌شده‌ای در کارتابل شما وجود ندارد.</p>}
      {cases.map(item => (
        <article key={item.id} className="flex flex-col gap-3 border-t border-ink-100 pt-3 first:border-0 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm">{item.violation_type} · تاکسی {item.taxi_identifier}</strong>
            <span className="rounded-full bg-gold-100 px-3 py-1 text-xs text-gold-700">در انتظار رأی کمیته</span>
          </div>
          <p className="text-xs text-ink-600">بازرس خط: {item.reporter_name} · تماس: {item.reporter_phone || 'ثبت نشده'}</p>
          <p className="text-xs text-ink-600">راننده مورد گزارش: {item.accused_driver_name || 'نامشخص'} · محل وقوع: {item.location}</p>
          <p className="whitespace-pre-wrap text-sm leading-6">{item.description}</p>
          <div className="rounded-lg bg-ink-50 p-3 text-sm">
            **گزارش کارشناس بازرسی درباره سازش:**
            <p className="mt-1 whitespace-pre-wrap text-ink-600">{item.settlement_note || 'نتیجه سازش ثبت نشده'}</p>
          </div>
          <label className="flex flex-col gap-1 text-xs text-ink-600">رأی کمیته
            <select value={decisions[item.id] ?? ''} onChange={e => setDecisions(old => ({ ...old, [item.id]: e.target.value }))} className="field-input">
              <option value="">انتخاب رأی</option>
              {DECISIONS.map(decision => <option key={decision}>{decision}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">مستندات و توضیحات رأی (اختیاری)
            <textarea rows={3} maxLength={3000} value={notes[item.id] ?? ''} onChange={e => setNotes(old => ({ ...old, [item.id]: e.target.value }))} className="field-input" />
          </label>
          <button type="button" className="btn self-start" disabled={busyId === item.id} onClick={() => void issueVerdict(item)}>
            {busyId === item.id ? 'در حال ثبت…' : 'ثبت رأی و ارسال برای تأیید مدیر'}
          </button>
        </article>
      ))}
    </section>
  );
}
