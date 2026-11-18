import {
  Archive,
  BadgeCheck,
  Bell,
  CalendarDays,
  Car,
  FileText,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Settings,
  UserCheck,
  UserCog,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { StaffRole } from '@/lib/staff';

export const ENTITY_KEYS = ['drivers', 'vehicles', 'licenses', 'documents', 'reminders', 'violations'] as const;

export type EntityKey = (typeof ENTITY_KEYS)[number];
export type PageKey = 'dashboard' | 'requests' | 'leave' | 'messages' | 'secretariat' | 'archive' | 'users' | 'settings' | 'profile' | EntityKey;

export type RecordValue = string | number | null;
export type RecordPayload = Record<string, RecordValue>;
export type FleetRecord = { id: string; created_at: string } & RecordPayload;
export type RestoreRow = { id: string } & RecordPayload;
export type FleetData = Record<EntityKey, FleetRecord[]>;
export type BackupData = Partial<Record<EntityKey, RestoreRow[]>>;

export const DONE_STATUS = 'انجام‌شده';

export type FieldType = 'text' | 'tel' | 'number' | 'date' | 'textarea' | 'select' | 'plate' | 'driver';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
};

type EntityConfig = {
  title: string;
  singular: string;
  icon: LucideIcon;
  fields: FieldDef[];
  columns: { key: string; label: string }[];
  dateFields?: string[];
};

export const entityConfigs: Record<EntityKey, EntityConfig> = {
  drivers: {
    title: 'مالکان خودرو',
    singular: 'مالک خودرو',
    icon: Users,
    fields: [
      { key: 'name', label: 'نام و نام خانوادگی مالک / شخص', type: 'text', required: true },
      { key: 'national_code', label: 'کد ملی', type: 'text' },
      { key: 'phone', label: 'شماره تماس', type: 'tel' },
      { key: 'license_number', label: 'شماره گواهینامه', type: 'text' },
      { key: 'route', label: 'خط / مسیر', type: 'text' },
      { key: 'address', label: 'آدرس', type: 'textarea' },
      { key: 'status', label: 'وضعیت', type: 'select', options: ['فعال', 'در انتظار بررسی', 'غیرفعال'] },
      { key: 'notes', label: 'توضیحات', type: 'textarea' },
    ],
    columns: [
      { key: 'name', label: 'نام راننده' },
      { key: 'national_code', label: 'کد ملی' },
      { key: 'phone', label: 'تماس' },
      { key: 'route', label: 'مسیر' },
      { key: 'address', label: 'آدرس' },
      { key: 'status', label: 'وضعیت' },
    ],
  },
  vehicles: {
    title: 'خودروها',
    singular: 'خودرو',
    icon: Car,
    fields: [
      { key: 'plate', label: 'شماره پلاک', type: 'plate', required: true },
      { key: 'model', label: 'نوع / مدل خودرو', type: 'text' },
      { key: 'taxi_row_no', label: 'ردیف تاکسی', type: 'text' },
      { key: 'driver_id', label: 'مالک / شخص مرتبط', type: 'driver' },
      { key: 'driver_name', label: 'نام راننده (اطلاعات تکمیلی)', type: 'text' },
      { key: 'year', label: 'سال ساخت', type: 'number' },
      { key: 'insurance_expires', label: 'انقضای بیمه', type: 'date' },
      { key: 'inspection_expires', label: 'معاینه فنی تا', type: 'date' },
      { key: 'status', label: 'وضعیت', type: 'select', options: ['فعال', 'نیازمند بررسی', 'غیرفعال', 'در حال اسقاط'] },
      { key: 'notes', label: 'توضیحات', type: 'textarea' },
    ],
    columns: [
      { key: 'plate', label: 'پلاک' },
      { key: 'model', label: 'مدل' },
      { key: 'taxi_row_no', label: 'ردیف تاکسی' },
      { key: 'driver_name', label: 'نام راننده' },
      { key: 'insurance_expires', label: 'انقضای بیمه' },
      { key: 'status', label: 'وضعیت' },
    ],
    dateFields: ['insurance_expires', 'inspection_expires'],
  },
  licenses: {
    title: 'پروانه‌ها',
    singular: 'پروانه',
    icon: BadgeCheck,
    fields: [
      { key: 'kind', label: 'نوع مجوز', type: 'text', required: true },
      { key: 'number', label: 'شماره مجوز', type: 'text' },
      { key: 'owner', label: 'نام دارنده', type: 'text' },
      { key: 'driver_id', label: 'راننده مرتبط', type: 'driver' },
      { key: 'issued_on', label: 'تاریخ صدور', type: 'date' },
      { key: 'expires_on', label: 'تاریخ انقضا', type: 'date' },
      { key: 'status', label: 'وضعیت', type: 'select', options: ['معتبر', 'در حال بررسی', 'منقضی'] },
      { key: 'notes', label: 'توضیحات', type: 'textarea' },
    ],
    columns: [
      { key: 'kind', label: 'نوع مجوز' },
      { key: 'number', label: 'شماره' },
      { key: 'owner', label: 'دارنده' },
      { key: 'expires_on', label: 'انقضا' },
      { key: 'status', label: 'وضعیت' },
    ],
    dateFields: ['expires_on'],
  },
  documents: {
    title: 'مدارک تمدید',
    singular: 'مدرک',
    icon: FileText,
    fields: [
      { key: 'title', label: 'عنوان مدرک', type: 'text', required: true },
      { key: 'related_to', label: 'مرتبط با (راننده/خودرو)', type: 'text' },
      { key: 'driver_id', label: 'راننده مرتبط', type: 'driver' },
      { key: 'number', label: 'شماره مدرک', type: 'text' },
      { key: 'expires_on', label: 'تاریخ انقضا', type: 'date' },
      { key: 'status', label: 'وضعیت', type: 'select', options: ['کامل', 'ناقص', 'نیازمند تمدید'] },
      { key: 'notes', label: 'توضیحات', type: 'textarea' },
    ],
    columns: [
      { key: 'title', label: 'مدرک' },
      { key: 'related_to', label: 'مرتبط با' },
      { key: 'number', label: 'شماره' },
      { key: 'expires_on', label: 'انقضا' },
      { key: 'status', label: 'وضعیت' },
    ],
    dateFields: ['expires_on'],
  },
  reminders: {
    title: 'یادآوری‌ها',
    singular: 'یادآوری',
    icon: Bell,
    fields: [
      { key: 'title', label: 'عنوان یادآوری', type: 'text', required: true },
      { key: 'remind_on', label: 'تاریخ یادآوری', type: 'date' },
      { key: 'category', label: 'دسته‌بندی', type: 'select', options: ['بیمه', 'معاینه فنی', 'مجوز', 'مدارک', 'سایر'] },
      { key: 'status', label: 'وضعیت', type: 'select', options: ['باز', DONE_STATUS] },
      { key: 'notes', label: 'توضیحات', type: 'textarea' },
    ],
    columns: [
      { key: 'title', label: 'عنوان' },
      { key: 'remind_on', label: 'تاریخ' },
      { key: 'category', label: 'دسته‌بندی' },
      { key: 'status', label: 'وضعیت' },
    ],
  },
  violations: {
    title: 'کمیته انضباطی',
    singular: 'تخلف',
    icon: Flag,
    fields: [
      { key: 'recorded_on', label: 'تاریخ ثبت', type: 'date' },
      { key: 'plate', label: 'شماره پلاک', type: 'plate' },
      { key: 'driver_name', label: 'نام راننده', type: 'text' },
      { key: 'driver_id', label: 'راننده مرتبط', type: 'driver' },
      { key: 'kind', label: 'نوع تخلف', type: 'text', required: true },
      { key: 'amount', label: 'مبلغ جریمه (تومان)', type: 'number' },
      { key: 'status', label: 'وضعیت رسیدگی', type: 'select', options: ['ثبت‌شده', 'در حال بررسی', 'مختومه'] },
      { key: 'notes', label: 'شرح تخلف', type: 'textarea' },
    ],
    columns: [
      { key: 'recorded_on', label: 'تاریخ' },
      { key: 'plate', label: 'پلاک' },
      { key: 'driver_name', label: 'راننده' },
      { key: 'kind', label: 'نوع تخلف' },
      { key: 'amount', label: 'مبلغ' },
      { key: 'status', label: 'وضعیت' },
      { key: 'objection_decision', label: 'نتیجه اعتراض' },
    ],
  },
};

export type NavItem = { key: PageKey; label: string; icon: LucideIcon; roles: StaffRole[] };

const EDITOR_ROLES: StaffRole[] = ['admin', 'manager', 'expert'];
const ALL_ROLES: StaffRole[] = ['admin', 'manager', 'expert', 'driver'];
const DRIVER_ENTITIES: EntityKey[] = ['drivers', 'licenses', 'documents', 'violations'];
const DRIVER_LABELS: Partial<Record<PageKey, string>> = {
  drivers: 'پروفایل من',
  messages: 'پیام‌های من',
};

export const navItems: NavItem[] = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard, roles: ALL_ROLES },
  { key: 'profile', label: 'پروفایل من', icon: UserCircle, roles: ALL_ROLES },
  { key: 'requests', label: 'ثبت‌نام‌های جدید', icon: UserCheck, roles: EDITOR_ROLES },
  ...ENTITY_KEYS.map(key => ({
    key,
    label: entityConfigs[key].title,
    icon: entityConfigs[key].icon,
    roles: DRIVER_ENTITIES.includes(key) ? ALL_ROLES : EDITOR_ROLES,
  })),
  { key: 'leave', label: 'مرخصی‌ها', icon: CalendarDays, roles: ALL_ROLES },
  { key: 'messages', label: 'پیام‌ها', icon: MessageSquare, roles: ALL_ROLES },
  { key: 'secretariat', label: 'دبیرخانه', icon: FileText, roles: EDITOR_ROLES },
  { key: 'archive', label: 'بایگانی مدارک', icon: Archive, roles: EDITOR_ROLES },
  { key: 'users', label: 'کاربران', icon: UserCog, roles: ['admin', 'manager'] },
  { key: 'settings', label: 'پشتیبان‌گیری', icon: Settings, roles: ['manager'] },
];

export function navItemsForRole(role: StaffRole): NavItem[] {
  return navItems
    .filter(item => item.roles.includes(role))
    .map(item => (role === 'driver' && DRIVER_LABELS[item.key] ? { ...item, label: DRIVER_LABELS[item.key] ?? item.label } : item));
}

export function defaultPageForRole(): PageKey {
  return 'dashboard';
}

const STAFF_MOBILE_NAV_KEYS: PageKey[] = ['dashboard', 'requests', 'leave', 'messages', 'secretariat', 'settings'];
const DRIVER_MOBILE_NAV_KEYS: PageKey[] = ['dashboard', 'drivers', 'licenses', 'violations', 'leave', 'messages'];

export function mobileNavKeysForRole(role: StaffRole): PageKey[] {
  return role === 'driver' ? DRIVER_MOBILE_NAV_KEYS : STAFF_MOBILE_NAV_KEYS;
}

export function createEmptyFleetData(): FleetData {
  return {
    drivers: [],
    vehicles: [],
    licenses: [],
    documents: [],
    reminders: [],
    violations: [],
  };
}
