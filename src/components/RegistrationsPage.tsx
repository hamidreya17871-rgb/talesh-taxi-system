import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { callStaffApi } from '@/lib/staffApi';

export type PendingRegistration = {
  user_id: string;
  full_name: string;
  phone: string;
  national_code: string;
  plate: string;
  model: string;
  taxi_row_no: string;
  created_at: string;
};

type Decision = 'approve' | 'reject';

type Props = {
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

export default function RegistrationsPage({ onNotify }: Props) {
  const [items, setItems] = useState<PendingRegistration[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await callStaffApi<{ items: PendingRegistration[] }>('list-registrations');
      setItems(result.items);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'عملیات انجام نشد.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(item: PendingRegistration, decision: Decision) {
    setBusyId(item.user_id);
    try {
      await callStaffApi('review-registration', { user_id: item.user_id, decision });
      onNotify(decision === 'approve' ? 'راننده تأیید شد' : 'درخواست رد شد');
      await load();
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'عملیات انجام نشد.', 'error');
    }
    setBusyId(null);
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">درخواست‌های ثبت‌نام رانندگان</h2>
          <p className="mt-1 text-sm text-ink-600">اطلاعات هر راننده را بررسی و تأیید یا رد کنید.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          <RefreshCw size={16} />
          به‌روزرسانی
        </button>
      </header>

      {items === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}

      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {items && items.length === 0 && <p className="py-16 text-center text-ink-600">درخواست در انتظار بررسی وجود ندارد.</p>}

      {items && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(item => (
            <article key={item.user_id} className="panel flex flex-col gap-4">
              <div>
                <h3 className="font-bold">{item.full_name}</h3>
                <p dir="ltr" className="mt-1 text-sm text-ink-600">{item.phone}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="کد ملی" value={item.national_code} />
                <Detail label="ردیف تاکسی" value={item.taxi_row_no} />
                <Detail label="پلاک خودرو" value={item.plate} />
                <Detail label="مدل خودرو" value={item.model} />
              </dl>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn flex-1"
                  disabled={busyId === item.user_id}
                  onClick={() => void decide(item, 'approve')}
                >
                  <Check size={16} />
                  تأیید
                </button>
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  disabled={busyId === item.user_id}
                  onClick={() => void decide(item, 'reject')}
                >
                  <X size={16} />
                  رد
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-600">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || '—'}</dd>
    </div>
  );
}
