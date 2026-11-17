export const ARCHIVE_BUCKET = 'archive-documents';
export const ARCHIVE_FILE_MAX_BYTES = 10 * 1024 * 1024;

export const ARCHIVE_CATEGORIES = ['driver', 'vehicle', 'ownership_transfer', 'inspection', 'committee', 'other'] as const;
export type ArchiveCategory = (typeof ARCHIVE_CATEGORIES)[number];

export const ARCHIVE_CATEGORY_LABELS: Record<ArchiveCategory, string> = {
  driver: 'مدارک راننده',
  vehicle: 'مدارک خودرو',
  ownership_transfer: 'پرونده انتقال مالکیت',
  inspection: 'بازرسی',
  committee: 'کمیته انضباطی',
  other: 'سایر مدارک',
};

export type ArchiveDocument = {
  id: string;
  category: ArchiveCategory;
  driver_id: string | null;
  vehicle_id: string | null;
  title: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  created_at: string;
  drivers: { name: string | null } | null;
  vehicles: { plate: string | null; model: string | null } | null;
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function archiveFileExtension(file: File): string | null {
  return EXTENSION_BY_TYPE[file.type] ?? null;
}

export function validateArchiveFile(file: File | undefined): string | null {
  if (!file) return 'لطفاً فایل مدرک را انتخاب کنید.';
  if (!archiveFileExtension(file)) return 'فقط فایل PDF، JPG یا PNG قابل قبول است.';
  if (file.size > ARCHIVE_FILE_MAX_BYTES) return 'حجم فایل نباید بیش از ۱۰ مگابایت باشد.';
  return null;
}
