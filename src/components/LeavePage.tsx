import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatNumber, formatPersianDate, todayIso } from '@/lib/format';
import { LEAVE_FREE_DAYS_PER_MONTH, LEAVE_STATUS_LABELS, freeLeaveDaysUsed, type LeaveRequest, type LeaveStatus } from '@/lib/leave';
import type { Profile } from '@/lib/staff';
import LeaveRequestModal from '@/components/LeaveRequestModal';
import LeaveLetterModal from '@/components/LeaveLetterModal';

type Props = {
  profile: Profile;
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

const LOAD_ERROR = 'اطلاعات مرخصی‌ها دریافت نشد. لطفاً دوباره تلاش کنید.';
const ACTION_ERROR = 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.';

export default function LeavePage({ profile, onNotify }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [letterRequest, setLetterRequest] = useState<LeaveRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isDriver = profile.role === 'driver';
  const isManager = profile.role === 'manager';
  const canReview = profile.role === 'manager' || profile.role === 'expert';
  const freeDaysLeft = Math.max(0, LEAVE_FREE_DAYS_PER_MONTH - (requests ? freeLeaveDaysUsed(requests, todayIso()) : 0));

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, drivers(name)')
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(LOAD_ERROR);
      return;
    }
    setRequests(data as LeaveRequest[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(request: LeaveRequest, status: Exclude<LeaveStatus, 'pending'>) {
    setBusyId(request.id);
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status, reviewed_by: profile.user_id, reviewed_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    setBusyId(null);
    if (error || !data) {
      onNotify(data ? ACTION_ERROR : 'این درخواست قبلاً بررسی شده است؛ فهرست به‌روزرسانی شد.', 'error');
      void load();
      return;
    }
    onNotify(status === 'approved' ? 'درخواست تأیید شد' : 'درخواست رد شد');
    void load();
  }

  async function remove(request: LeaveRequest) {
    if (!window.confirm('این درخواست مرخصی حذف شود؟')) return;
    setBusyId(request.id);
    const { error } = await supabase.from('leave_requests').delete().eq('id', request.id);
    setBusyId(null);
    if (error) {
      onNotify(ACTION_ERROR, 'error');
      return;
    }
    onNotify('درخواست حذف شد');
    void load();
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">مرخصی‌ها</h2>
          <p className="mt-1 text-sm text-ink-600">
            {isDriver ? 'درخواست‌های مرخصی شما' : 'درخواست‌های مرخصی رانندگان'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            به‌روزرسانی
          </button>
          {isDriver && profile.driver_id && (
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              <Plus size={16} />
              درخواست مرخصی
            </button>
          )}
        </div>
      </header>

      {isDriver && requests && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50">
          <p className="text-sm">
            <span className="font-bold">{formatNumber(freeDaysLeft)} روز</span> از {formatNumber(LEAVE_FREE_DAYS_PER_MONTH)} روز مرخصی این ماه بدون نیاز به تأیید سازمان باقی مانده است.
          </p>
          <p className="text-xs text-ink-600">مرخصی بیش از این مقدار نیاز به تأیید سازمان دارد.</p>
        </div>
      )}

      {requests === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}

      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {requests && requests.length === 0 && <p className="py-16 text-center text-ink-600">درخواستی ثبت نشده است.</p>}

      {requests && requests.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map(request => (
            <article key={request.id} className="panel flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{request.drivers?.name ?? 'راننده'}</h3>
                  <p className="mt-1 text-sm text-ink-600">
                    {request.leave_type} · {request.days} روز · نامه شماره {request.letter_no}
                  </p>
                </div>
                <span className="rounded-full bg-ink-100 px-3 py-1 text-xs">{LEAVE_STATUS_LABELS[request.status]}</span>
              </div>
              <p className="text-sm">
                از {formatPersianDate(request.start_date)} تا {formatPersianDate(request.end_date)}
              </p>
              {request.reason && <p className="text-sm text-ink-600">{request.reason}</p>}

              {request.status === 'approved' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-tiny"
                    onClick={() => setLetterRequest(request)}
                  >
                    <Printer size={13} />
                    چاپ نامه
                  </button>
                </div>
              )}
              {(canReview && request.status === 'pending') || isManager ? (
                <div className="flex flex-wrap gap-2">
                  {canReview && request.status === 'pending' && (
                    <>
                      <button type="button" className="btn-tiny" disabled={busyId === request.id} onClick={() => void review(request, 'approved')}>
                        <Check size={13} />
                        تأیید
                      </button>
                      <button type="button" className="btn-tiny btn-tiny-danger" disabled={busyId === request.id} onClick={() => void review(request, 'rejected')}>
                        <X size={13} />
                        رد
                      </button>
                    </>
                  )}
                  {isManager && (
                    <button type="button" className="btn-tiny btn-tiny-danger" disabled={busyId === request.id} onClick={() => void remove(request)}>
                      <Trash2 size={13} />
                      حذف
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {creating && profile.driver_id && (
        <LeaveRequestModal
          driverId={profile.driver_id}
          onNotify={onNotify}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
      {letterRequest && (
        <LeaveLetterModal request={letterRequest} onNotify={onNotify} onClose={() => setLetterRequest(null)} />
      )}
    </section>
  );
}
