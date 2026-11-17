# سامانه مدیریت حمل‌ونقل و تاکسیرانی تالش

## Security configuration before deployment

- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the web build.
- Configure `STAFF_REGISTRATION_CODE` only as a Supabase Edge Function secret. It is required for first-manager bootstrap and expert registration. Public staff registration must not create manager accounts; additional managers are created by an authenticated manager. Never put this value in frontend code or commit it.
- The connected Supabase project is `xrhzsafezpwdztjytkob` and is currently `ACTIVE_HEALTHY`. The database has 51 migration-history entries. The production release branch has 51 SQL migration files; the security/attachment PR adds two more. Legacy filename/version mapping is not one-to-one, and the first fleet migration has a different recorded name. **Do not run `supabase db push` or replay migrations until the full history is reconciled against a verified backup and staging database.**
- Current live aggregate counts: `drivers=11`, `vehicles=11`, `licenses=1`, `auth.users=1`, and `profiles=1` (one active, approved manager). Letters and leave requests are currently empty. The original JSON backup did not contain Auth users or Storage objects; the manager account was created later in the live project.
- All 24 public tables currently have RLS enabled. The three Storage buckets (`driver-licenses`, `archive-documents`, `line-report-evidence`) are private and currently contain zero objects.
- The `public.letter_attachments` table already exists and has zero rows, but its migration is not recorded in the 51-entry migration history. Reconcile this schema drift before running migrations. The current attachment metadata SELECT policy is broader than the letter visibility policy; the security/attachment PR contains the narrower policy.
- A live security review found unwanted DDL-level table grants to `anon` and `authenticated`, and a public `SECURITY DEFINER` rate-limit helper callable by `anon`. The pending migration `20261117103000_harden_anon_api_privileges.sql` removes those grants and moves internal helpers into the private schema while preserving the citizen-report form's six column-only INSERT fields. **This migration is not yet applied to production.**
- The `manage-staff` Edge Function is active at version 9. It validates staff bearer tokens internally even though `verify_jwt=false`; bootstrap and expert registration require `STAFF_REGISTRATION_CODE`. The connected tooling cannot confirm whether that secret is present; verify its existence in Supabase Function Secrets without sharing its value.
- Because one active manager profile already exists, the first-manager bootstrap path should no longer be used. Verify access to the existing manager account before creating staff accounts.

## Build and release checks

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Set the public frontend variables in the hosting environment before building. Never put the Supabase service-role key or `STAFF_REGISTRATION_CODE` in frontend variables or commit them.

## Android APK (Capacitor)

The current source is a web/PWA project; it does not yet contain a generated Android project or a signed APK. After the web build passes and the production Supabase environment is configured, use a machine with Android Studio, Android SDK and a compatible JDK installed:

```bash
npm install @capacitor/core @capacitor/android
npm install --save-dev @capacitor/cli
npx cap init "تاکسیرانی تالش" ir.talesh.taxi --web-dir=dist
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, use **Build → Generate Signed Bundle / APK → APK**, create or select the organization's release keystore, and securely back up the keystore and passwords. Do not distribute a debug APK as the production release. A signed APK has not been generated or verified.

## Supabase release checklist

1. Create and verify a database backup, then reconcile the migration filename/version history in a staging environment. Do not use `supabase db push` until the mismatch is resolved.
2. Apply the pending security and letter-attachment migrations only after staging validation and backup; verify the resulting grants, RLS policies and Storage access.
3. Confirm `STAFF_REGISTRATION_CODE` exists only as a Supabase Edge Function secret. Do not send its value in chat.
4. Verify login for the existing manager account, then test manager, expert and driver flows with separate test accounts. The database currently has only one manager profile.
5. Verify archive upload/download, letter creation, referral, citizen reports and driver activation with authenticated test sessions before importing more personal data.
6. Keep production credentials and personal data out of the repository and build logs.

## وضعیت استقرار

پروژه Supabase فعال است. در حال حاضر ۱۱ راننده، ۱۱ خودرو، یک پروانه و یک حساب مدیر فعال و تأییدشده وجود دارد. سه bucket خصوصی Storage خالی هستند. مهاجرت‌های امنیتی و پیوست نامه هنوز باید پس از تهیه پشتیبان و آزمون staging تعیین تکلیف شوند. انتشار وب و آزمون end-to-end هنوز تأیید نشده است. جزئیات در `RELEASE-STATUS.md` و راهنمای Cloudflare Pages در `CLOUDFLARE-PAGES.md` ثبت شده است.

## انتشار وب

راهنمای اتصال GitHub به Cloudflare Pages و تنظیم متغیرهای امن در `CLOUDFLARE-PAGES.md` قرار دارد. شاخه production مستندشده `release/standalone-railway` است؛ شاخه پیش‌فرض `main` را به‌جای آن منتشر نکنید.

## نصب روی گوشی

این پروژه PWA دارد. پس از انتشار روی HTTPS و تأیید ثبت Service Worker، آدرس production را در Chrome اندروید باز کنید و از منوی مرورگر «Install app» یا «Add to Home screen» را انتخاب کنید. راهنمای Android APK در همین فایل آمده است.
