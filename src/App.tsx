import { useState } from 'react';
import Dashboard from '@/components/Dashboard';
import DriverDashboard from '@/components/DriverDashboard';
import DriverLicensesPage from '@/components/DriverLicensesPage';
import DriverViolationsPage from '@/components/DriverViolationsPage';
import ObjectionReviewModal from '@/components/ObjectionReviewModal';
import LoginPage from '@/components/LoginPage';
import MobileNav from '@/components/MobileNav';
import MobileDrawer from '@/components/MobileDrawer';
import RecordFormModal from '@/components/RecordFormModal';
import RecordsPage from '@/components/RecordsPage';
import RegistrationsPage from '@/components/RegistrationsPage';
import LeavePage from '@/components/LeavePage';
import DriverMessagesPage from '@/components/DriverMessagesPage';
import StaffMessagesPage from '@/components/StaffMessagesPage';
import SecretariatPage from '@/components/SecretariatPage';
import ArchivePage from '@/components/ArchivePage';
import UsersPage from '@/components/UsersPage';
import SettingsPage from '@/components/SettingsPage';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import TopBar from '@/components/TopBar';
import { useFleetData } from '@/hooks/useFleetData';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import {
  ENTITY_KEYS,
  defaultPageForRole,
  mobileNavKeysForRole,
  navItemsForRole,
  navItems,
  type EntityKey,
  type FleetRecord,
  type PageKey,
  type RecordPayload,
} from '@/lib/fleetConfig';
import { buildBackup, buildCsv, downloadFile, parseBackup } from '@/lib/fileExport';
import { todayIso } from '@/lib/format';
import { LICENSE_APPROVED_STATUS } from '@/lib/reviews';
import type { Profile } from '@/lib/staff';

const GENERIC_ERROR = 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.';

type EditorState = { entity: EntityKey; record: FleetRecord | null };

export default function App() {
  const { status: sessionStatus, profile, signOut } = useSession();

  if (sessionStatus === 'loading') {
    return <p className="py-24 text-center text-ink-600">در حال بارگذاری…</p>;
  }
  if (sessionStatus === 'signed-out') return <LoginPage />;
  if (sessionStatus === 'pending') {
    return (
      <AccountMessage
        title="ثبت‌نام شما دریافت شد"
        detail="اطلاعات شما در انتظار بررسی و تأیید مدیر یا کارشناس است. پس از تأیید می‌توانید وارد سامانه شوید."
        onSignOut={() => void signOut()}
      />
    );
  }
  if (sessionStatus === 'rejected') {
    return (
      <AccountMessage
        title="درخواست دسترسی تأیید نشده است"
        detail="درخواست حساب شما رد شده است. برای بررسی علت و پیگیری، با مدیر سازمان تماس بگیرید."
        onSignOut={() => void signOut()}
      />
    );
  }
  if (sessionStatus === 'inactive') {
    return (
      <AccountMessage
        title="حساب کاربری فعال نیست"
        detail="حساب شما غیرفعال است یا هنوز به سامانه متصل نشده است. با مدیر سازمان تماس بگیرید."
        onSignOut={() => void signOut()}
      />
    );
  }
  if (sessionStatus === 'error' || !profile) {
    return (
      <AccountMessage
        title="اطلاعات دریافت نشد"
        detail="اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کنید."
        onSignOut={() => void signOut()}
      />
    );
  }
  return <Workspace profile={profile} onSignOut={() => void signOut()} />;
}

function AccountMessage({ title, detail, onSignOut }: { title: string; detail: string; onSignOut: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center p-[18px]">
      <div className="panel w-full max-w-md text-center">
        <p className="mb-4 font-bold">{title}</p>
        <p className="mb-5 text-ink-600">{detail}</p>
        <div className="flex justify-center gap-2">
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            تلاش دوباره
          </button>
          <button type="button" className="btn btn-secondary" onClick={onSignOut}>
            خروج از حساب
          </button>
        </div>
      </div>
    </div>
  );
}

function Workspace({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const [page, setPage] = useState<PageKey>(() => defaultPageForRole());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [objectionReview, setObjectionReview] = useState<FleetRecord | null>(null);
  const { data, status, reload, saveRecord, removeRecord, restoreBackup } = useFleetData();
  const { toast, showToast } = useToast();

  const items = navItemsForRole(profile.role);
  const pageLabel = navItems.find(item => item.key === page)?.label ?? '';
  const readOnly = profile.role === 'driver';

  async function handleSave(entity: EntityKey, id: string | null, payload: RecordPayload): Promise<boolean> {
    try {
      await saveRecord(entity, id, payload);
      showToast('اطلاعات با موفقیت ذخیره شد');
      setEditor(null);
      return true;
    } catch {
      showToast(GENERIC_ERROR, 'error');
      return false;
    }
  }

  async function handleDelete(entity: EntityKey, record: FleetRecord) {
    if (!window.confirm('این مورد حذف شود؟')) return;
    try {
      await removeRecord(entity, record.id);
      showToast('مورد حذف شد');
    } catch {
      showToast(GENERIC_ERROR, 'error');
    }
  }

  async function handleReview(entity: EntityKey, record: FleetRecord) {
    if (entity === 'violations') {
      setObjectionReview(record);
      return;
    }
    try {
      await saveRecord(entity, record.id, { status: LICENSE_APPROVED_STATUS });
      showToast('پروانه تأیید شد');
    } catch {
      showToast(GENERIC_ERROR, 'error');
    }
  }

  async function handleObjectionDecision(decision: string): Promise<boolean> {
    if (!objectionReview) return false;
    try {
      await saveRecord('violations', objectionReview.id, { objection_decision: decision });
      showToast('نتیجه اعتراض ثبت شد');
      setObjectionReview(null);
      return true;
    } catch {
      showToast(GENERIC_ERROR, 'error');
      return false;
    }
  }

  function handleExport(entity: EntityKey) {
    downloadFile(buildCsv(entity, data[entity]), `${entity}-talesh.csv`, 'text/csv;charset=utf-8');
  }

  function handleBackup() {
    downloadFile(buildBackup(data), `talesh-taxi-backup-${todayIso()}.json`, 'application/json');
    showToast('نسخه پشتیبان آماده شد');
  }

  async function handleRestore(file: File) {
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch {
      showToast('فایل پشتیبان معتبر نیست', 'error');
      return;
    }
    if (Object.keys(backup).length === 0) {
      showToast('فایل پشتیبان معتبر نیست', 'error');
      return;
    }
    if (!window.confirm('فقط ردیف‌های جدید از فایل به سامانه اضافه می‌شوند؛ ردیف‌های فعلی نه بازنویسی و نه حذف خواهند شد. ادامه می‌دهید؟')) return;
    try {
      await restoreBackup(backup);
      showToast('بازیابی انجام شد');
    } catch {
      showToast(GENERIC_ERROR, 'error');
    }
  }

  function renderPage() {
    if (status === 'loading') {
      return <p className="py-24 text-center text-ink-600">در حال بارگذاری اطلاعات…</p>;
    }
    if (status === 'error') {
      return (
        <div className="panel mx-auto max-w-md text-center">
          <p className="mb-4 font-bold">اطلاعات دریافت نشد</p>
          <p className="mb-5 text-ink-600">اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کنید.</p>
          <button type="button" className="btn" onClick={() => void reload()}>
            تلاش دوباره
          </button>
        </div>
      );
    }
    if (page === 'dashboard') {
      return profile.role === 'driver' ? (
        <DriverDashboard data={data} profile={profile} onNavigate={setPage} />
      ) : (
        <Dashboard data={data} isManager={profile.role === 'manager'} onNavigate={setPage} />
      );
    }
    if (page === 'requests') return <RegistrationsPage onNotify={showToast} />;
    if (page === 'licenses' && profile.role === 'driver') {
      return (
        <DriverLicensesPage
          licenses={data.licenses}
          driverId={profile.driver_id}
          driverName={profile.full_name}
          onNotify={showToast}
          onUploaded={() => void reload()}
        />
      );
    }
    if (page === 'violations' && profile.role === 'driver') {
      return <DriverViolationsPage violations={data.violations} onSubmitted={() => void reload()} />;
    }
    if (page === 'users') return <UsersPage onNotify={showToast} />;
    if (page === 'leave') return <LeavePage profile={profile} onNotify={showToast} />;
    if (page === 'secretariat') return <SecretariatPage profile={profile} onNotify={showToast} />;
    if (page === 'archive') return <ArchivePage onNotify={showToast} />;
    if (page === 'messages') {
      return profile.role === 'driver' ? (
        <DriverMessagesPage />
      ) : (
        <StaffMessagesPage drivers={data.drivers} canDelete={profile.role === 'manager'} onNotify={showToast} />
      );
    }
    if (page === 'settings') {
      return <SettingsPage onBackup={handleBackup} onRestore={file => void handleRestore(file)} />;
    }
    if (!(ENTITY_KEYS as readonly string[]).includes(page)) {
      return <p className="py-24 text-center text-ink-600">این بخش به‌زودی فعال می‌شود.</p>;
    }
    const entity = page as EntityKey;
    return (
      <RecordsPage
        key={entity}
        entity={entity}
        records={data[entity]}
        readOnly={readOnly}
        onCreate={() => setEditor({ entity, record: null })}
        onEdit={record => setEditor({ entity, record })}
        onDelete={record => void handleDelete(entity, record)}
        onReview={record => void handleReview(entity, record)}
        onExport={() => handleExport(entity)}
      />
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} page={page} onNavigate={setPage} />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar title={pageLabel} profile={profile} onSignOut={onSignOut} onMenuClick={() => setDrawerOpen(true)} />
        <div className="mx-auto w-full max-w-[1500px] flex-1 p-[26px] max-[1000px]:p-[18px] max-[650px]:px-3 max-[650px]:pb-[85px] max-[650px]:pt-[15px]">
          {renderPage()}
        </div>
        <footer className="p-[18px] text-center text-[11px] text-ink-600 max-[650px]:pb-[85px]">
          سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش
        </footer>
      </main>
      <MobileNav items={items} keys={mobileNavKeysForRole(profile.role)} page={page} onNavigate={setPage} />
      <MobileDrawer items={items} page={page} open={drawerOpen} onNavigate={setPage} onClose={() => setDrawerOpen(false)} />
      {editor && (
        <RecordFormModal
          entity={editor.entity}
          record={editor.record}
          drivers={data.drivers}
          onSave={payload => handleSave(editor.entity, editor.record?.id ?? null, payload)}
          onClose={() => setEditor(null)}
        />
      )}
      {objectionReview && (
        <ObjectionReviewModal
          violation={objectionReview}
          onDecide={handleObjectionDecision}
          onClose={() => setObjectionReview(null)}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}
