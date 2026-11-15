import { BellRing } from 'lucide-react';
import { isLicenseReminderDue, licenseReminderDate } from '@/lib/driverLicenses';
import { formatPersianDate } from '@/lib/format';

type Props = {
  expiresOn: string | null;
};

export default function LicenseReminderNotice({ expiresOn }: Props) {
  if (!expiresOn || !isLicenseReminderDue(expiresOn)) return null;
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-gold-300 bg-gold-100 p-3 text-sm text-gold-700">
      <BellRing size={18} className="mt-0.5 shrink-0" />
      <p>
        یک ماه تا پایان اعتبار پروانه مانده است ({formatPersianDate(licenseReminderDate(expiresOn))}). لطفاً برای تمدید اقدام کنید.
      </p>
    </div>
  );
}
