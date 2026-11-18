import { useCallback, useEffect, useState } from 'react';
import { Clipboard, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type Profile } from '@/lib/staff';
import { callStaffApi } from '@/lib/staffApi';
import UserFormModal from '@/components/UserFormModal';
import SingleDriverModal from '@/components/SingleDriverModal';
import DriverLifecycleModal, { type DriverEndReason } from '@/components/DriverLifecycleModal';

type DriverOption = { id: string; name: string | null };

type Props = {
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

type EditorState = { user: Profile | null } | null;
type ActivationItem = { name: string; phone: string; activation_code: string; expires_at: string };
type ActivationResult = { issued: ActivationItem[]; skipped: Array<{ name?: string; phone?: string; reason: string }>; issued_count: number; skipped_count: number };

export default function UsersPage({ onNotify }: Props) {
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issuingCodes, setIssuingCodes] = useState(false);
  const [activationResult, setActivationResult] = useState<ActivationResult | null>(null);
  const [singleDriverOpen, setSingleDriverOpen] = useState(false);
  const [singleDriverActivation, setSingleDriverActivation] = useState<ActivationItem | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<Profile | null>(null);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [claimingAdmin, setClaimingAdmin] = useState(false);

  const currentProfile = users?.find(user => user.user_id === currentUserId) ?? null;
  const activeAdminExists = (users ?? []).some(user => user.role === 'admin' && user.is_active);
  const canClaimInitialAdmin = currentProfile?.role === 'manager' && currentProfile.is_active && !activeAdminExists;

  const visibleUsers = (users ?? []).filter(user => showInactiveUsers ? !user.is_active : user.is_active);

  const load = useCallback(async () => {
    setLoadError(null);
    const [authResult, profilesResult, driversResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('profiles').select('*').eq('approval_status', 'approved').order('created_at', { ascending: true }),
      supabase.from('drivers').select('id, name').order('name', { ascending: true }),
    ]);
    setCurrentUserId(authResult.data.user?.id ?? null);
    if (profilesResult.error || driversResult.error) {
      setLoadError('اطلاعات کاربران دریافت نشد. لطفاً دوباره تلاش کنید.');
      return;
    }
    setUsers(profilesResult.data as Profile[]);
    setDrivers(driversResult.data as DriverOption[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function claimInitialAdmin() {
    if (!window.confirm('حساب مدیر سازمان شما به مدیرکل سامانه ارتقا می‌یابد. این امکان فقط یک‌بار و در صورت نبود مدیرکل فعال وجود دارد. ادامه می‌دهید؟')) return;
    setClaimingAdmin(true);
    try {
      await callStaffApi('claim-initial-admin');
      onNotify('حساب شما مدیرکل سامانه شد. صفحه برای بارگذاری سطح دسترسی جدید بازخوانی می‌شود.');
      window.setTimeout(() => window.location.reload(), 900);
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'ارتقای مدیرکل انجام نشد.', 'error');
      setClaimingAdmin(false);
    }
  }

  async function issueExistingDriverCodes() {
    setIssuingCodes(true);
    setActivationResult(null);
    try {
      const result = await callStaffApi<ActivationResult>('issue-existing-driver-codes');
      setActivationResult(result);
      onNotify(`${result.issued_count} کد فعال‌سازی صادر شد`);
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'صدور کدها انجام نشد.', 'error');
    } finally {
      setIssuingCodes(false);
    }
  }

  async function copyActivationCodes() {
    if (!activationResult?.issued.length) return;
    const text = activationResult.issued
      .map(item => `${item.name} | ${item.phone} | ${item.activation_code}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      onNotify('فهرست کدها کپی شد');
    } catch {
      onNotify('کپی خودکار ممکن نیست؛ کدها را دستی انتخاب کنید.', 'error');
    }
  }

  async function endDriverActivity(user: Profile, reason: DriverEndReason, note: string) {
    setBusyId(user.user_id);
    try {
      await callStaffApi('deactivate-driver', { user_id: user.user_id, reason, note });
      setLifecycleTarget(null);
      onNotify('دسترسی راننده قطع شد و سابقه پرونده حفظ شد.');
      void load();
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'ثبت پایان فعالیت انجام نشد.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function reactivateDriver(user: Profile) {
    if (!window.confirm(`راننده «${user.full_name}» دوباره فعال شود؟`)) return;
    setBusyId(user.user_id);
    try {
      await callStaffApi('reactivate-driver', { user_id: user.user_id });
      onNotify('حساب راننده دوباره فعال شد.');
      void load();
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'فعال‌سازی مجدد انجام نشد.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function removeExpert(user: Profile) {
    if (!window.confirm(`کارشناس «${user.full_name}» حذف شود؟ دسترسی او به سامانه قطع می‌شود.`)) return;
    setBusyId(user.user_id);
    try {
      await callStaffApi('delete-expert', { user_id: user.user_id });
      onNotify('کارشناس حذف شد');
      void load();
    } catch {
      onNotify('حذف کارشناس انجام نشد. لطفاً دوباره تلاش کنید.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">کاربران سامانه</h2>
          <p className="mt-1 text-sm text-ink-600">حساب مدیران، کارشناسان و رانندگان را مدیریت کنید.</p>
        </div>
        <div className="flex gap-2">
          {canClaimInitialAdmin && (
            <button type="button" className="btn" disabled={claimingAdmin} onClick={() => void claimInitialAdmin()}>
              {claimingAdmin ? 'در حال ارتقا…' : 'ارتقای حساب من به مدیرکل سامانه'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            به‌روزرسانی
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => { setSingleDriverActivation(null); setSingleDriverOpen(true); }}>
            <Plus size={16} />
            افزودن راننده تکی
          </button>
          <button type="button" className="btn" onClick={() => setEditor({ user: null })}>
            <Plus size={16} />
            افزودن کاربر
          </button>
        </div>
      </header>

      {singleDriverActivation && (
        <div className="panel border border-brand-200 bg-brand-50/50">
          <h3 className="font-bold">کد فعال‌سازی راننده جدید</h3>
          <p className="mt-1 text-sm">{singleDriverActivation.name} · <span dir="ltr">{singleDriverActivation.phone}</span></p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="rounded-lg bg-white px-4 py-2 text-lg font-bold tracking-widest">{singleDriverActivation.activation_code}</code>
            <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard.writeText(singleDriverActivation.activation_code).then(() => onNotify('کد فعال‌سازی کپی شد')).catch(() => onNotify('کپی کد ممکن نشد.', 'error'))}>کپی کد</button>
          </div>
          <p className="mt-2 text-xs text-ink-600">اعتبار تا {new Date(singleDriverActivation.expires_at).toLocaleDateString('fa-IR')} · کد فقط همین بار نمایش داده می‌شود؛ آن را خصوصی به راننده تحویل دهید.</p>
        </div>
      )}

      <div className="panel flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">فعال‌سازی رانندگان ثبت‌شده</h3>
            <p className="mt-1 text-sm text-ink-600">برای رانندگانی که هنوز حساب کاربری ندارند، کد یک‌بارمصرف صادر می‌شود. اطلاعات پرونده و خودرو تغییر نمی‌کند.</p>
          </div>
          <button type="button" className="btn" disabled={issuingCodes} onClick={() => void issueExistingDriverCodes()}>
            <Clipboard size={16} />
            {issuingCodes ? 'در حال صدور…' : 'صدور کدهای فعال‌سازی'}
          </button>
        </div>
        {activationResult && (
          <div className="rounded-lg border border-ink-200 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{activationResult.issued_count} کد صادر شد؛ {activationResult.skipped_count} مورد رد شد.</p>
              <button type="button" className="btn btn-secondary" onClick={() => void copyActivationCodes()} disabled={!activationResult.issued.length}>
                <Clipboard size={14} /> کپی همه کدها
              </button>
            </div>
            {activationResult.issued.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr>
                    <th className="px-2 py-2 text-right">راننده</th>
                    <th className="px-2 py-2 text-right">موبایل</th>
                    <th className="px-2 py-2 text-right">کد یک‌بارمصرف</th>
                    <th className="px-2 py-2 text-right">مهلت</th>
                  </tr></thead>
                  <tbody>{activationResult.issued.map(item => (
                    <tr key={item.phone} className="border-t border-ink-200">
                      <td className="px-2 py-2">{item.name}</td>
                      <td dir="ltr" className="px-2 py-2 text-right">{item.phone}</td>
                      <td dir="ltr" className="px-2 py-2 font-mono">{item.activation_code}</td>
                      <td className="px-2 py-2">{new Date(item.expires_at).toLocaleDateString('fa-IR')}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {activationResult.skipped.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">موارد صادرنشده ({activationResult.skipped.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pr-5 text-ink-600">
                  {activationResult.skipped.map((item, index) => <li key={index}>{item.name ?? item.phone ?? 'راننده'}: {item.reason}</li>)}
                </ul>
              </details>
            )}
            <p className="mt-3 text-xs text-ink-600">کدها فقط همین بار نمایش داده می‌شوند؛ آن‌ها را خصوصی برای راننده مربوطه بفرستید. اعتبار هر کد ۳۰ روز است.</p>
          </div>
        )}
      </div>

      {users === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}

      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {users && users.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2" role="group" aria-label="فیلتر کاربران">
            <button type="button" className={`btn-tiny ${!showInactiveUsers ? 'btn-tiny-active' : ''}`} onClick={() => setShowInactiveUsers(false)}>
              کاربران فعال ({users.filter(user => user.is_active).length})
            </button>
            <button type="button" className={`btn-tiny ${showInactiveUsers ? 'btn-tiny-active' : ''}`} onClick={() => setShowInactiveUsers(true)}>
              بایگانی کاربران غیرفعال ({users.filter(user => !user.is_active).length})
            </button>
          </div>
          <span className="text-xs text-ink-600">غیرفعال‌سازی، سوابق و پرونده کاربر را حذف نمی‌کند.</span>
        </div>
      )}

      {users && visibleUsers.length === 0 && <p className="py-12 text-center text-ink-600">{showInactiveUsers ? 'کاربر غیرفعالی در بایگانی نیست.' : 'کاربر فعالی ثبت نشده است.'}</p>}

      {users && visibleUsers.length > 0 && (
        <div className="panel overflow-x-auto p-0">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-ink-200 bg-ink-50 px-3 py-3 text-right text-xs font-normal text-ink-600">نام</th>
                <th className="border-b border-ink-200 bg-ink-50 px-3 py-3 text-right text-xs font-normal text-ink-600">موبایل</th>
                <th className="border-b border-ink-200 bg-ink-50 px-3 py-3 text-right text-xs font-normal text-ink-600">نقش</th>
                <th className="border-b border-ink-200 bg-ink-50 px-3 py-3 text-right text-xs font-normal text-ink-600">وضعیت</th>
                <th className="border-b border-ink-200 bg-ink-50 px-3 py-3 text-right text-xs font-normal text-ink-600">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(user => (
                <tr key={user.user_id} className="hover:bg-ink-50/60">
                  <td className="border-b border-ink-200 px-3 py-3">{user.full_name}</td>
                  <td dir="ltr" className="border-b border-ink-200 px-3 py-3 text-right">{user.phone ?? '—'}</td>
                  <td className="border-b border-ink-200 px-3 py-3">{ROLE_LABELS[user.role]}</td>
                  <td className="border-b border-ink-200 px-3 py-3">{user.is_active ? 'فعال' : 'غیرفعال'}</td>
                  <td className="border-b border-ink-200 px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {user.user_id !== currentUserId && (
                        <button type="button" className="btn-tiny" onClick={() => setEditor({ user })}>
                          <Pencil size={13} />
                          ویرایش
                        </button>
                      )}
                      {user.role === 'expert' && (
                        <button
                          type="button"
                          className="btn-tiny btn-tiny-danger"
                          disabled={busyId === user.user_id}
                          onClick={() => void removeExpert(user)}
                        >
                          <Trash2 size={13} />
                          حذف
                        </button>
                      )}
                      {user.role === 'driver' && user.driver_id && user.is_active && (
                        <button
                          type="button"
                          className="btn-tiny btn-tiny-danger"
                          disabled={busyId === user.user_id}
                          onClick={() => setLifecycleTarget(user)}
                        >
                          حذف از کاربران
                        </button>
                      )}
                      {user.role === 'driver' && user.driver_id && !user.is_active && (
                        <button
                          type="button"
                          className="btn-tiny"
                          disabled={busyId === user.user_id}
                          onClick={() => void reactivateDriver(user)}
                        >
                          فعال‌سازی مجدد
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lifecycleTarget && (
        <DriverLifecycleModal
          driverName={lifecycleTarget.full_name}
          busy={busyId === lifecycleTarget.user_id}
          onClose={() => setLifecycleTarget(null)}
          onSubmit={(reason, note) => void endDriverActivity(lifecycleTarget, reason, note)}
        />
      )}

      {singleDriverOpen && (
        <SingleDriverModal
          onClose={() => setSingleDriverOpen(false)}
          onNotify={onNotify}
          onCreated={activation => { setSingleDriverOpen(false); setSingleDriverActivation(activation); void load(); }}
        />
      )}

      {editor && (
        <UserFormModal
          user={editor.user}
          drivers={drivers}
          canManageManagers={currentProfile?.role === 'admin'}
          onNotify={onNotify}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void load();
          }}
        />
      )}
    </section>
  );
}
