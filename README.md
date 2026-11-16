# سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش

## Security configuration before deployment

- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the web build.
- Configure `STAFF_REGISTRATION_CODE` only as a Supabase Edge Function secret. It is used for first-manager bootstrap and expert registration; public staff registration must not create manager accounts. Additional managers must be created by an authenticated manager in the user-management panel. Never put this value in frontend code or commit it.
- Deploy the `manage-staff` Edge Function after setting its secret.
- Apply all SQL migrations in `supabase/migrations` in filename order. The latest migration removes the legacy anonymous access policies from fleet tables.
- Confirm the Supabase project has Row Level Security enabled and test each role (manager, expert, driver) before using real personal data.


## Build and release checks

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Set the two `VITE_SUPABASE_*` variables in the hosting environment before building. Never put the Supabase service-role key or `STAFF_REGISTRATION_CODE` in frontend variables or commit them.

## Android APK (Capacitor)

The current source is a web/PWA project; it does not yet contain a generated Android project or a signed APK. After the web build passes and the production Supabase environment is configured, use a machine with Android Studio, Android SDK and a JDK installed:

```bash
npm install @capacitor/core @capacitor/android
npm install --save-dev @capacitor/cli
npx cap init "تاکسیرانی تالش" ir.talesh.taxi --web-dir=dist
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, use **Build → Generate Signed Bundle / APK → APK**, create or select the organization's release keystore, and securely back up the keystore and passwords. Do not distribute a debug APK as the production release. A signed APK has not been generated or verified in this source-only environment.

## Supabase release checklist

1. Apply every migration in `supabase/migrations` in filename order, including the secretariat tables and the fleet-access hardening migration.
2. Deploy `supabase/functions/manage-staff` and set `STAFF_REGISTRATION_CODE` as a server-side function secret.
3. Verify the manager, expert and driver flows against the actual Supabase project with separate test accounts. Check anonymous access is denied for every personal-data table and both private storage buckets.
4. Verify archive upload/download, letter creation and referral using real authenticated sessions before importing real records.
5. Keep production credentials and personal data out of the repository and build logs.

## وضعیت استقرار

پایگاه داده Supabase در پروژه مقصد ایجاد شده و ۲۱ migration به‌صورت امن اعمال شده‌اند. دسترسی `anon` به جدول‌های اطلاعاتی بسته است و RLS برای تمام ۱۲ جدول عمومی فعال است. با این حال Edge Function `manage-staff`، Secret راه‌اندازی مدیر اولیه، انتشار وب و آزمون نهایی هنوز باقی مانده‌اند. جزئیات را در `RELEASE-STATUS.md` ببینید.


## نصب روی گوشی

این پروژه PWA دارد. پس از انتشار روی HTTPS، آدرس را در Chrome اندروید باز کنید و از منوی مرورگر «Install app» یا «Add to Home screen» را انتخاب کنید. راهنمای کامل انتشار، متغیرهای محیطی و نصب در فایل `راهنمای-نصب-و-انتشار.md` است.
