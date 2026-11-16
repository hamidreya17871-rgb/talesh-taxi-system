# سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش

## Security configuration before deployment

- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the web build.
- Configure `STAFF_REGISTRATION_CODE` only as a Supabase Edge Function secret. It is used for first-manager bootstrap and expert registration; public staff registration must not create manager accounts. Additional managers must be created by an authenticated manager in the user-management panel. Never put this value in frontend code or commit it.
- Deploy the `manage-staff` Edge Function after setting its secret.
- The connected Supabase project (`xrhzsafezpwdztjytkob`) currently has 51 migration-history entries, matching the 51 migration files in `release/standalone-railway`. The JSON backup has been restored into it: `drivers=11`, `vehicles=11`, `licenses=1`. `auth.users=0`, `profiles=0`, and operational records such as letters/leave requests remain empty. Three Storage buckets exist but contain zero objects; attachment files were not included in the JSON backup. Never replay an applied migration. The restored fleet data is not evidence that the original Bolt database or its files were migrated.
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

1. Verify the restored 11 drivers, 11 vehicles and 1 license in the connected project. The source JSON backup did not include Storage objects or Auth users/profiles; do not assume old attachments or login accounts were restored.
2. Confirm `STAFF_REGISTRATION_CODE` is configured only as a Supabase Edge Function secret. `manage-staff` is active at deployed version 7; never put the secret in frontend configuration.
3. Create the first manager through the application's initial-setup screen, then test manager, expert and driver flows with separate accounts. Check anonymous access and Storage policies before importing additional personal data.
4. Verify archive upload/download, letter creation and referral using real authenticated sessions before importing real records.
5. Keep production credentials and personal data out of the repository and build logs.

## وضعیت استقرار

پروژه Supabase متصل ۵۱ سابقه migration دارد و ۵۱ فایل migration شاخه انتشار با آن تطبیق داده شده‌اند. از نسخه پشتیبان، ۱۱ راننده، ۱۱ خودرو و یک پروانه بازیابی شده‌اند. حساب‌های ورود و پروفایل‌ها هنوز ساخته نشده‌اند و فایل‌های Storage نیز در پشتیبان موجود نبودند. راهنمای انتشار رایگان Cloudflare Pages در `CLOUDFLARE-PAGES.md` قرار دارد؛ انتشار واقعی هنوز انجام نشده است. جزئیات در `RELEASE-STATUS.md` ثبت شده است.


## انتشار وب

راهنمای اتصال خودکار GitHub به Cloudflare Pages و تنظیم متغیرهای امن در `CLOUDFLARE-PAGES.md` قرار دارد.

## نصب روی گوشی

این پروژه PWA دارد. پس از انتشار روی HTTPS، آدرس را در Chrome اندروید باز کنید و از منوی مرورگر «Install app» یا «Add to Home screen» را انتخاب کنید. راهنمای کامل انتشار، متغیرهای محیطی و نصب در فایل `راهنمای-نصب-و-انتشار.md` است.
