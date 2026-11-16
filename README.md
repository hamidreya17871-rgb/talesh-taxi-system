# سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش

## Security configuration before deployment

- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the web build.
- Configure `STAFF_REGISTRATION_CODE` only as a Supabase Edge Function secret. It is used for first-manager bootstrap and expert registration; public staff registration must not create manager accounts. Additional managers must be created by an authenticated manager in the user-management panel. Never put this value in frontend code or commit it.
- Deploy the `manage-staff` Edge Function after setting its secret.
- The only Supabase project currently connected for inspection (`xrhzsafezpwdztjytkob`) records 22 migration-history entries, but its `drivers`, `profiles`, `vehicles`, `letters` and `letter_referrals` tables currently contain zero rows. It is therefore **not verified as the live production database**. The development branch contains 43 migration files; 21 additional migrations require ordered review and testing. Do not apply them or switch hosting until the actual Bolt database containing the 11 reported drivers is identified and backed up. Never replay a migration already recorded in Supabase.
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

1. Identify the actual production Supabase project from the running Bolt app, verify the 11 existing driver records, and take database plus Storage backups. The currently connected project has zero driver/profile/vehicle/letter rows and must not be assumed to be production. Review the 21 additional branch migrations in a separate staging environment; do not replay any of the 22 already-recorded migrations.
2. Deploy `supabase/functions/manage-staff` and set `STAFF_REGISTRATION_CODE` as a server-side function secret.
3. Verify the manager, expert and driver flows against the actual Supabase project with separate test accounts. Check anonymous access is denied for every personal-data table and both private storage buckets.
4. Verify archive upload/download, letter creation and referral using real authenticated sessions before importing real records.
5. Keep production credentials and personal data out of the repository and build logs.

## وضعیت استقرار

تنها پروژه Supabase متصل برای بررسی، ۲۲ سابقه migration دارد اما جدول‌های راننده، پروفایل، خودرو، نامه و ارجاع در آن خالی هستند؛ بنابراین دیتابیس عملیاتی دارای ۱۱ راننده هنوز شناسایی نشده است. شاخه توسعه ۴۳ فایل migration دارد که ۲۱ مورد جدید باید در محیط staging بازبینی و آزمایش شوند. تا شناسایی و پشتیبان‌گیری از دیتابیس واقعی، هیچ migration روی دیتابیس زنده اجرا نمی‌شود. جزئیات در `RELEASE-STATUS.md` ثبت شده است.


## نصب روی گوشی

این پروژه PWA دارد. پس از انتشار روی HTTPS، آدرس را در Chrome اندروید باز کنید و از منوی مرورگر «Install app» یا «Add to Home screen» را انتخاب کنید. راهنمای کامل انتشار، متغیرهای محیطی و نصب در فایل `راهنمای-نصب-و-انتشار.md` است.
