import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Pencil, Plus, Printer, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callStaffApi } from '@/lib/staffApi';
import LetterFormModal, { letterDateText, type LetterRecord } from '@/components/LetterFormModal';
import ReferralModal from '@/components/ReferralModal';
import { printLetter } from '@/lib/letterhead';
import type { Profile } from '@/lib/staff';
import CitizenReportsPanel from '@/components/CitizenReportsPanel';
import LineInspectorReports from '@/components/LineInspectorReports';
import DisciplinaryCommitteePanel from '@/components/DisciplinaryCommitteePanel';
import DisciplinaryManagerApprovalPanel from '@/components/DisciplinaryManagerApprovalPanel';
import OutgoingLetterWorkflowActions from '@/components/OutgoingLetterWorkflowActions';
import SecretariatManagementPanel from '@/components/SecretariatManagementPanel';
import LetterAdministrationPanel from '@/components/LetterAdministrationPanel';

type Props = {
  profile: Profile;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

type StaffOption = { user_id: string; full_name: string };

type WorkflowEvent = { id: string; letter_id: string; event_type: string; details: Record<string, unknown>; created_at: string; actor_id: string | null; actor: { full_name: string | null } | { full_name: string | null }[] | null };

type ReferralRow = {
  id: string;
  letter_id: string;
  referred_to: string;
  action: string;
  note: string | null;
  status: string;
  created_at: string;
  due_at: string | null;
  reviewer: { full_name: string | null } | { full_name: string | null }[] | null;
};

const LOAD_ERROR = 'نامه‌ها دریافت نشد. لطفاً دوباره تلاش کنید.';
const ACTION_ERROR = 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.';
const ACTION_LABELS: Record<string, string> = { review: 'بررسی', 'follow-up': 'پیگیری', signature: 'امضا' };
const PRIORITY_LABELS: Record<string, string> = { normal: 'عادی', urgent: 'فوری', immediate: 'آنی' };
const EVENT_LABELS: Record<string, string> = { letter_registered: 'ثبت نامه', letter_edited: 'ویرایش محتوای نامه', priority_changed: 'تغییر فوریت', status_changed: 'تغییر وضعیت', referred: 'ارجاع به کارشناس', referral_completed: 'ثبت انجام ارجاع', deadline_changed: 'تغییر سررسید اقدام' };
const FIELD_LABELS: Record<string, string> = { subject: 'موضوع', body: 'متن', correspondent: 'فرستنده/گیرنده', letter_no: 'شماره نامه', letter_date: 'تاریخ نامه', attachment_path: 'پیوست' };
const formatTehranDateTime = (value: string) => new Date(value).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });

export default function SecretariatPage({ profile, onNotify }: Props) {
  const [letters, setLetters] = useState<LetterRecord[] | null>(null);
  const [referrals, setReferrals] = useState<Map<string, ReferralRow[]>>(new Map());
  const [workflowEvents, setWorkflowEvents] = useState<Map<string, WorkflowEvent[]>>(new Map());
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<LetterRecord | null | undefined>(undefined);
  const [referralLetter, setReferralLetter] = useState<LetterRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const isManager = profile.role === 'manager';
  const isCommitteeOnly = profile.role === 'expert' && Boolean(profile.is_disciplinary_committee);

  const load = useCallback(async () => {
    if (isCommitteeOnly) return;
    setLoadError(null);
    try {
      const [lettersResult, referralsResult, eventsResult, staffResult] = await Promise.all([
        supabase.from('letters').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase
          .from('letter_referrals')
          .select('id, letter_id, referred_to, action, note, status, created_at, due_at, reviewer:referred_to(full_name)')
          .order('created_at', { ascending: false }),
        supabase.from('letter_workflow_events').select('id, letter_id, event_type, details, created_at, actor_id, actor:actor_id(full_name)').order('created_at', { ascending: false }).limit(1000),
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
      const eventMap = new Map<string, WorkflowEvent[]>();
      for (const event of (eventsResult.data ?? []) as WorkflowEvent[]) {
        const list = eventMap.get(event.letter_id) ?? [];
        list.push(event);
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        eventMap.set(event.letter_id, list);
      }
      setWorkflowEvents(eventMap);
      setStaff(staffResult.items);
    } catch {
      setLoadError(LOAD_ERROR);
    }
  }, [isCommitteeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isCommitteeOnly) {
    return (
      <section className="flex flex-col gap-5">
        <DisciplinaryCommitteePanel profile={profile} />
      </section>
    );
  }

  async function remove(letter: LetterRecord) {
    if (!window.confirm('این نامه از فهرست فعال خارج و به بایگانی منتقل شود؟ سابقه و ارجاع‌ها حفظ می‌شوند.')) return;
    setBusyId(letter.id);
    const { error } = await supabase.from('letters').update({ deleted_at: new Date().toISOString(), deleted_by: profile.user_id }).eq('id', letter.id);
    setBusyId(null);
    if (error) {
      onNotify(ACTION_ERROR, 'error');
      return;
    }
    onNotify('نامه به بایگانی منتقل شد؛ سوابق و ارجاع‌ها محفوظ است');
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

  const normalizeSearch = (value: string) =>
    value
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .trim()
      .toLocaleLowerCase('fa');
  const query = normalizeSearch(search);
  const visible = (letters ?? []).filter(l => {
    const directionMatches = filter === 'all' || l.direction === filter;
    const statusMatches = statusFilter === 'all' || l.status === statusFilter;
    const searchable = normalizeSearch([l.letter_no, l.subject, l.body, l.correspondent].filter(Boolean).join(' '));
    return directionMatches && statusMatches && (!query || searchable.includes(query));
  });
  const pendingCount = (letters ?? []).filter(l =>
    ['ثبت شده', 'در حال بررسی', 'ارجاع شده', 'در انتظار بررسی کارشناس', 'در انتظار تأیید مدیر', 'در انتظار امضا', 'در انتظار پاسخ'].includes(l.status)
  ).length;
  const statusOptions = [...new Set((letters ?? []).map(l => l.status).filter(Boolean))];

  return (
    <section className="flex flex-col gap-5">
      <CitizenReportsPanel profile={profile} />
      <LineInspectorReports profile={profile} mode="staff" />
      {profile.is_disciplinary_committee && <DisciplinaryCommitteePanel profile={profile} />}
      {profile.role === 'manager' && <DisciplinaryManagerApprovalPanel profile={profile} />}
      {isManager && <SecretariatManagementPanel profile={profile} onNotify={onNotify} />}
      {isManager && <LetterAdministrationPanel profile={profile} onNotify={onNotify} />}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="panel">
          <p className="text-xs text-ink-600">کل مکاتبات</p>
          <p className="mt-1 text-2xl font-bold">{letters?.length ?? '—'}</p>
        </div>
        <div className="panel">
          <p className="text-xs text-ink-600">نامه‌های وارده</p>
          <p className="mt-1 text-2xl font-bold">{(letters ?? []).filter(l => l.direction === 'incoming').length}</p>
        </div>
        <div className="panel">
          <p className="text-xs text-ink-600">در جریان اقدام</p>
          <p className="mt-1 text-2xl font-bold">{pendingCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="جست‌وجو در شماره، موضوع، فرستنده، گیرنده و متن نامه"
            className="field-input pr-9"
            aria-label="جست‌وجوی مکاتبات"
          />
        </label>
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value)}
          className="field-input"
          aria-label="فیلتر وضعیت نامه"
        >
          <option value="all">همه وضعیت‌ها</option>
          {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
        </select>
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

      {letters && visible.length === 0 && <p className="py-16 text-center text-ink-600">برای این فیلتر یا عبارت جست‌وجو، نامه‌ای پیدا نشد.</p>}

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
                  <span className="rounded-full bg-ink-100 px-3 py-1 text-xs">{letter.status}</span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-ink-100 px-2.5 py-1">فوریت: {PRIORITY_LABELS[letter.priority ?? 'normal'] ?? 'عادی'}</span>{letter.response_due_at && <span className="rounded-full bg-gold-50 px-2.5 py-1 text-gold-700">مهلت پاسخ: {formatTehranDateTime(letter.response_due_at)}</span>}</div>
                {letter.body && <p className="line-clamp-2 text-sm text-ink-600">{letter.body}</p>}

                {(letter.expert_reviewed_at || letter.manager_signed_at || letter.manager_order_note || letter.sent_at || letter.delivery_receipt_path) && (
                  <div className="rounded-lg border border-ink-100 p-3 text-xs text-ink-600 flex flex-col gap-1">
                    {letter.expert_reviewed_at && <p>کارشناس بررسی‌کننده: {staff.find(member => member.user_id === letter.expert_reviewed_by)?.full_name ?? 'حساب کاربری ثبت‌شده'} · {new Date(letter.expert_reviewed_at).toLocaleString('fa-IR')}</p>}
                    {letter.manager_signed_at && <p>مدیر تأییدکننده: {staff.find(member => member.user_id === letter.manager_signed_by)?.full_name ?? 'حساب کاربری ثبت‌شده'} · {new Date(letter.manager_signed_at).toLocaleString('fa-IR')}</p>}
                    {letter.manager_order_note && <p>دستور مدیر: {letter.manager_order_note}</p>}
                    {letter.sent_at && <p>تاریخ ارسال: {new Date(letter.sent_at).toLocaleString('fa-IR')} {letter.sent_method ? `· ${letter.sent_method}` : ''}</p>}
                    {letter.delivery_receipt_path && <p>مسیر رسید تحویل: {letter.delivery_receipt_path}</p>}
                  </div>
                )}

                <OutgoingLetterWorkflowActions letter={letter} profile={profile} onSaved={() => void load()} onNotify={onNotify} />

                {(workflowEvents.get(letter.id) ?? []).length > 0 && (
                  <details className="border-t border-ink-100 pt-2">
                    <summary className="cursor-pointer text-xs font-bold text-ink-600">مشاهده گردش کامل دبیرخانه ({(workflowEvents.get(letter.id) ?? []).length} رویداد)</summary>
                    <ol className="mt-3 flex flex-col gap-2 border-r-2 border-ink-100 pr-3">
                      {(workflowEvents.get(letter.id) ?? []).map(event => (
                        <li key={event.id} className="text-xs">
                          <p className="font-medium">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
                          <p className="mt-0.5 text-ink-500">{formatTehranDateTime(event.created_at)}{event.actor ? ` · ${Array.isArray(event.actor) ? event.actor[0]?.full_name ?? 'کاربر ثبت‌شده' : event.actor.full_name ?? 'کاربر ثبت‌شده'}` : ''}</p>
                          {typeof event.details.note === 'string' && <p className="mt-0.5 text-ink-600">{event.details.note}</p>}
                          {Array.isArray(event.details.changed_fields) && <p className="mt-0.5 text-ink-600">فیلدهای تغییرکرده: {event.details.changed_fields.map(field => FIELD_LABELS[String(field)] ?? String(field)).join('، ')}</p>}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

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
                            {ref.note ? ` · ${ref.note}` : ''}{ref.due_at ? ` · سررسید: ${formatTehranDateTime(ref.due_at)}` : ''}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={ref.status === 'done' ? 'text-brand-600' : 'text-gold-700'}>
                              {ref.status === 'done' ? 'انجام شد' : 'در انتظار'}
                            </span>
                            {ref.status === 'pending' && (isManager || ref.referred_to === profile.user_id) && (
                              <button type="button" className="btn-tiny" disabled={busyId === ref.id} onClick={() => void completeReferral(ref)}>
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
                  {!(letter.direction === 'outgoing' && ['امضا شده', 'صادر شده', 'مختومه'].includes(letter.status)) && <button type="button" className="btn-tiny" onClick={() => setEditor(letter)}>
                    <Pencil size={13} />
                    ویرایش
                  </button>}
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
                  <button type="button" className="btn-tiny" onClick={() => setReferralLetter(letter)}>
                    <ArrowRightLeft size={13} />
                    ارجاع
                  </button>
                  {isManager && (
                    <button type="button" className="btn-tiny btn-tiny-danger" disabled={busyId === letter.id} onClick={() => void remove(letter)}>
                      <Trash2 size={13} />
                      بایگانی نامه
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
