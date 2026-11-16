import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Pencil, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callStaffApi } from '@/lib/staffApi';
import LetterFormModal, { letterDateText, type LetterRecord } from '@/components/LetterFormModal';
import ReferralModal from '@/components/ReferralModal';
import { printLetter } from '@/lib/letterhead';
import type { Profile } from '@/lib/staff';

type Props = {
  profile: Profile;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

type StaffOption = { user_id: string; full_name: string };

type ReferralRow = {
  id: string;
  letter_id: string;
  referred_to: string;
  action: string;
  note: string | null;
  status: string;
  created_at: string;
  reviewer: { full_name: string | null } | { full_name: string | null }[] | null;
};

const LOAD_ERROR = 'نامه‌ها دریافت نشد. لطفاً دوباره تلاش کنید.';
const ACTION_ERROR = 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.';
const ACTION_LABELS: Record<string, string> = { review: 'بررسی', 'follow-up': 'پیگیری', signature: 'امضا' };

export default function SecretariatPage({ profile, onNotify }: Props) {
  const [letters, setLetters] = useState<LetterRecord[] | null>(null);
  const [referrals, setReferrals] = useState<Map<string, ReferralRow[]>>(new Map());
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<LetterRecord | null | undefined>(undefined);
  const [referralLetter, setReferralLetter] = useState<LetterRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');

  const isManager = profile.role === 'manager';

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [lettersResult, referralsResult, staffResult] = await Promise.all([
        supabase.from('letters').select('*, signer:signed_by(full_name)').order('created_at', { ascending: false }),
        supabase
          .from('letter_referrals')
          .select('id, letter_id, referred_to, action, note, status, created_at, reviewer:referred_to(full_name)')
          .order('created_at', { ascending: false }),
        callStaffApi<{ items: StaffOption[] }>('list-staff'),
      ]);
      if (lettersResult.error || referralsResult.error) {
        setLoadError(LOAD_ERROR);
        return;
      }
      setLetters(lettersResult.data as LetterRecord[]);

      const referralMap = new Map<string, ReferralRow[]>();
      for (const row of (referralsResult.data ?? []) as unknown as ReferralRow[]) {
        const list = referralMap.get(row.letter_id) ?? [];
        list.push(row);
        referralMap.set(row.letter_id, list);
      }
      setReferrals(referralMap);
      setStaff(staffResult.items);
    } catch {
      setLoadError(LOAD_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(letter: LetterRecord) {
    if (!window.confirm('این نامه حذف شود؟')) return;
    setBusyId(letter.id);
    const { error } = await supabase.from('letters').delete().eq('id', letter.id);
    setBusyId(null);
    if (error) {
      onNotify(ACTION_ERROR, 'error');
      return;
    }
    onNotify('نامه حذف شد');
    void load();
  }

  async function completeReferral(referral: ReferralRow) {
    setBusyId(referral.id);
    const { data, error } = await supabase.from('letter_referrals').update({
      status: 'done',
      completed_by: profile.user_id,
      completed_at: new Date().toISOString(),
    }).eq('id', referral.id).eq('status', 'pending').select('id').maybeSingle();
    setBusyId(null);
    if (error || !data) {
      onNotify('ثبت نتیجه ارجاع انجام نشد؛ احتمالاً وضعیت ارجاع تغییر کرده است.', 'error');
      return;
    }
    onNotify('انجام ارجاع ثبت شد.');
    void load();
  }

  const visible = (letters ?? []).filter(l => filter === 'all' || l.direction === filter);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">دبیرخانه</h2>
          <p className="mt-1 text-sm text-ink-600">مدیریت نامه‌های ورودی و خروجی با سربرگ سازمان</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            به‌روزرسانی
          </button>
          <button type="button" className="btn" onClick={() => setEditor(null)}>
            <Plus size={16} />
            نامه جدید
          </button>
        </div>
      </header>

      <div className="flex gap-2">
        {(['all', 'incoming', 'outgoing'] as const).map(f => (
          <button
            key={f}
            type="button"
            className={`btn-tiny ${filter === f ? 'bg-brand-600 text-white' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'همه' : f === 'incoming' ? 'ورودی' : 'خروجی'}
          </button>
        ))}
      </div>

      {letters === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}

      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {letters && visible.length === 0 && <p className="py-16 text-center text-ink-600">نامه‌ای ثبت نشده است.</p>}

      {letters && visible.length > 0 && (
        <div className="flex flex-col gap-4">
          {visible.map(letter => {
            const letterReferrals = referrals.get(letter.id) ?? [];
            return (
              <article key={letter.id} className="panel flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs ${letter.direction === 'incoming' ? 'bg-blue-50 text-blue-600' : 'bg-brand-50 text-brand-700'}`}>
                        {letter.direction === 'incoming' ? 'ورودی' : 'خروجی'}
                      </span>
                      <span className="text-xs text-ink-600">شماره {letter.letter_no}</span>
                    </div>
                    <h3 className="mt-1.5 font-bold">{letter.subject || 'بدون موضوع'}</h3>
                    <p className="mt-1 text-sm text-ink-600">
                      {letterDateText(letter)}
                      {letter.correspondent ? ` · ${letter.correspondent}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-ink-100 px-3 py-1 text-xs">{letter.status}</span>
                    {letter.status === 'امضا شده' && letter.signed_at && (
                      <span className="text-[11px] text-ink-600">
                        امضای نهایی: {Array.isArray(letter.signer) ? letter.signer[0]?.full_name : letter.signer?.full_name ?? 'مدیر'} · {new Date(letter.signed_at).toLocaleDateString('fa-IR')}
                      </span>
                    )}
                  </div>
                </div>

                {letter.body && <p className="line-clamp-2 text-sm text-ink-600">{letter.body}</p>}

                {letterReferrals.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-ink-100 pt-2">
                    <p className="text-xs font-bold text-ink-600">ارجاع‌ها:</p>
                    {letterReferrals.map(ref => {
                      const name = Array.isArray(ref.reviewer) ? ref.reviewer[0]?.full_name : ref.reviewer?.full_name;
                      return (
                        <div key={ref.id} className="flex items-center justify-between gap-2 text-xs">
                          <span>
                            <span className="font-medium">{name ?? 'کارشناس'}</span>
                            {' — '}
                            {ACTION_LABELS[ref.action] ?? ref.action}
                            {ref.note ? ` · ${ref.note}` : ''}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={ref.status === 'done' ? 'text-brand-600' : 'text-gold-700'}>
                              {ref.status === 'done' ? 'انجام شد' : 'در انتظار'}
                            </span>
                            {ref.status === 'pending' && (isManager || ref.referred_to === profile.user_id) && (
                              <button type="button" className="btn-tiny" onClick={() => void completeReferral(ref)}>
                                ثبت انجام
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {letter.status !== 'امضا شده' && (
                    <button type="button" className="btn-tiny" onClick={() => setEditor(letter)}>
                      <Pencil size={13} />
                      ویرایش
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-tiny"
                    onClick={() =>
                      printLetter({
                        letterNo: letter.letter_no,
                        date: letter.letter_date ?? letter.created_at,
                        subject: letter.subject,
                        body: letter.body,
                        correspondent: letter.correspondent ?? undefined,
                        attachment: letter.attachment_path,
                        direction: letter.direction,
                      })
                    }
                  >
                    <Printer size={13} />
                    چاپ
                  </button>
                  <button type="button" className="btn-tiny" disabled={letter.status === 'امضا شده' || letter.status === 'مختومه'} onClick={() => setReferralLetter(letter)}>
                    <ArrowRightLeft size={13} />
                    ارجاع
                  </button>
                  {isManager && (
                    <button type="button" className="btn-tiny btn-tiny-danger" disabled={busyId === letter.id || letter.status === 'امضا شده'} onClick={() => void remove(letter)}>
                      <Trash2 size={13} />
                      حذف
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editor !== undefined && (
        <LetterFormModal
          letter={editor}
          canSign={isManager && !!editor && (referrals.get(editor.id) ?? []).length > 0 && (referrals.get(editor.id) ?? []).every(ref => ref.status === 'done')}
          onNotify={onNotify}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined);
            void load();
          }}
        />
      )}

      {referralLetter && (
        <ReferralModal
          letter={referralLetter}
          staff={staff}
          currentUserId={profile.user_id}
          onNotify={onNotify}
          onClose={() => setReferralLetter(null)}
          onSaved={() => {
            setReferralLetter(null);
            void load();
          }}
        />
      )}
    </section>
  );
}
