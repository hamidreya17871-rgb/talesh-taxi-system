import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type Profile } from '@/lib/staff';
import { callStaffApi } from '@/lib/staffApi';
import UserFormModal from '@/components/UserFormModal';

type DriverOption = { id: string; name: string | null };

type Props = {
  onNotify: (message: string, kind?: 'success' | 'error') => void;
};

type EditorState = { user: Profile | null } | null;

export default function UsersPage({ onNotify }: Props) {
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const [profilesResult, driversResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('approval_status', 'approved').order('created_at', { ascending: true }),
      supabase.from('drivers').select('id, name').order('name', { ascending: true }),
    ]);
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
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            به‌روزرسانی
          </button>
          <button type="button" className="btn" onClick={() => setEditor({ user: null })}>
            <Plus size={16} />
            افزودن کاربر
          </button>
        </div>
      </header>

      {users === null && !loadError && <p className="py-16 text-center text-ink-600">در حال بارگذاری…</p>}

      {loadError && (
        <div className="panel text-center">
          <p className="mb-4 text-error-500">{loadError}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}

      {users && users.length === 0 && <p className="py-16 text-center text-ink-600">هنوز کاربری ثبت نشده است.</p>}

      {users && users.length > 0 && (
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
              {users.map(user => (
                <tr key={user.user_id} className="hover:bg-ink-50/60">
                  <td className="border-b border-ink-200 px-3 py-3">{user.full_name}</td>
                  <td dir="ltr" className="border-b border-ink-200 px-3 py-3 text-right">{user.phone ?? '—'}</td>
                  <td className="border-b border-ink-200 px-3 py-3">{ROLE_LABELS[user.role]}</td>
                  <td className="border-b border-ink-200 px-3 py-3">{user.is_active ? 'فعال' : 'غیرفعال'}</td>
                  <td className="border-b border-ink-200 px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-tiny" onClick={() => setEditor({ user })}>
                        <Pencil size={13} />
                        ویرایش
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <UserFormModal
          user={editor.user}
          drivers={drivers}
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
