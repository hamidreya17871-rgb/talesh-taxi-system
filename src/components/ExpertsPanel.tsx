import { useEffect, useState } from 'react';
import { UserCog } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import type { PageKey } from '@/lib/fleetConfig';
import { supabase } from '@/lib/supabase';

type ExpertProfile = { user_id: string; full_name: string; phone: string | null; is_active: boolean };
type ExpertRow = ExpertProfile & { reviewCount: number };

type Props = {
  onNavigate: (page: PageKey) => void;
};

const LOAD_ERROR = 'اطلاعات کارشناسان دریافت نشد.';

export default function ExpertsPanel({ onNavigate }: Props) {
  const [experts, setExperts] = useState<ExpertRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [profilesResult, reviewsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, phone, is_active')
          .eq('role', 'expert')
          .eq('approval_status', 'approved')
          .order('created_at', { ascending: true }),
        supabase.from('leave_requests').select('reviewed_by').not('reviewed_by', 'is', null),
      ]);
      if (!active) return;
      if (profilesResult.error || reviewsResult.error || !Array.isArray(profilesResult.data) || !Array.isArray(reviewsResult.data)) {
        setLoadError(true);
        return;
      }
      const counts = new Map<string, number>();
      for (const row of reviewsResult.data as { reviewed_by: string }[]) {
        counts.set(row.reviewed_by, (counts.get(row.reviewed_by) ?? 0) + 1);
      }
      setExperts(
        (profilesResult.data as ExpertProfile[]).map(expert => ({ ...expert, reviewCount: counts.get(expert.user_id) ?? 0 })),
      );
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="panel min-w-0">
      <div className="mb-[17px] flex items-center justify-between gap-3">
        <h3 className="text-base font-bold">کارشناسان</h3>
        <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-brand-50 text-brand-600">
          <UserCog size={18} />
        </span>
      </div>

      {loadError && <p className="py-6 text-center text-error-500">{LOAD_ERROR}</p>}
      {!loadError && experts === null && <p className="py-6 text-center text-ink-600">در حال بارگذاری…</p>}
      {experts && experts.length === 0 && <p className="py-6 text-center text-ink-600">هنوز کارشناسی ثبت نشده است.</p>}

      {experts && experts.length > 0 && (
        <div className="flex flex-col">
          {experts.map(expert => (
            <div
              key={expert.user_id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 py-3 first:border-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="truncate font-bold">{expert.full_name}</p>
                <p dir="ltr" className="text-right text-xs text-ink-600">
                  {expert.phone ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-600">{expert.reviewCount.toLocaleString('fa-IR')} مرخصی بررسی‌شده</span>
                <StatusBadge status={expert.is_active ? 'فعال' : 'غیرفعال'} />
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-secondary mt-3" onClick={() => onNavigate('users')}>
        مدیریت کاربران
      </button>
    </section>
  );
}
