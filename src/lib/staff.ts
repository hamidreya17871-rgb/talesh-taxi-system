export type StaffRole = 'admin' | 'manager' | 'expert' | 'driver';

export type Profile = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: StaffRole;
  driver_id: string | null;
  is_active: boolean;
  is_line_inspector?: boolean;
  is_disciplinary_committee?: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  signature_data_url?: string | null;
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'مدیرکل سامانه',
  manager: 'مدیر سازمان',
  expert: 'کارشناس',
  driver: 'راننده',
};

export const ROLE_OPTIONS: StaffRole[] = ['manager', 'expert', 'driver'];

export type StaffFormValues = {
  email: string;
  password: string;
  full_name: string;
  role: StaffRole;
  driver_id: string | null;
  is_active: boolean;
};
