# وضعیت آماده‌سازی انتشار — سامانه تاکسیرانی تالش

آخرین بازبینی: ۱۴۰۵/۰۸/۲۴

## موارد تأییدشده در Supabase

- پروژه `xrhzsafezpwdztjytkob` پاسخ‌گو است.
- ۲۱ مهاجرت اصلی و یک مهاجرت تکمیلی ایندکس‌ها (در مجموع ۲۲ مهاجرت) در تاریخچه ثبت شده‌اند.
- ۱۲ جدول در schema عمومی ایجاد شده و RLS برای هر ۱۲ جدول فعال است.
- بررسی مستقیم `has_table_privilege` نشان داد نقش `anon` روی هیچ‌یک از ۱۲ جدول مجوز SELECT، INSERT، UPDATE یا DELETE ندارد.
- تابع Edge به نام `manage-staff` با وضعیت `ACTIVE` و نسخه ۱ منتشر شده است؛ `verify_jwt=false` است و کد تابع خودش توکن کارکنان را اعتبارسنجی می‌کند. عملیات bootstrap و ثبت کارکنان نیز به Secret سمت سرور `STAFF_REGISTRATION_CODE` وابسته‌اند.
- صفر پروفایل/حساب در جدول `profiles` هنگام آخرین بررسی؛ هنوز مدیر اولیه ساخته نشده است.
- یک مهاجرت تکمیلی برای افزودن پنج ایندکس کلید خارجیِ گزارش‌شده توسط Performance Advisor اعمال شد.

## موارد بررسی‌نشده یا باقی‌مانده

- وجود و مقدار Secret با ابزار فعلی قابل خواندن/تأیید مستقیم نیست؛ کاربر اعلام کرده آن را در داشبورد تنظیم کرده است.
- درخواست واقعی HTTP به Edge Function و جریان bootstrap مدیر اولیه از این محیط قابل اجرا/تأیید نشد.
- `npm ci` در محیط بازبینی به پایان نرسید؛ بنابراین `npm run typecheck`، `npm run lint` و `npm run build` تأیید نشده‌اند.
- مخزن GitHub `hamidreya17871-rgb/talesh-taxi-system` هنوز خالی است؛ سورس در آن Commit نشده است.
- انتشار frontend در هاست، تست end-to-end با حساب‌های مدیر/کارشناس/راننده، و آزمون روی دستگاه واقعی انجام نشده‌اند.
- APK امضاشده تولید نشده است؛ در سورس فعلی پروژه Android/Capacitor آماده انتشار شناسایی نشده است.

## نکات امنیتی

- چهار هشدار Security Advisor مربوط به توابع `SECURITY DEFINER` قابل اجرا توسط نقش authenticated است. این توابع در سیاست‌های RLS/گردش کار ارجاع نامه استفاده می‌شوند؛ قبل از تغییر ACL یا تبدیل به INVOKER باید طراحی جایگزین و تست نقش‌ها انجام شود.
- هشدارهای Performance مربوط به بازخوانی توابع auth در policyها و چند policy مجاز هم‌پوشان هستند؛ این‌ها مانع امنیتی مستقیم نیستند و بهینه‌سازی بعدی می‌خواهند.
- فایل `.env.example` فقط URL و جای‌نگهدار کلید عمومی frontend را دارد. هرگز service-role key یا `STAFF_REGISTRATION_CODE` را در frontend یا مخزن GitHub قرار ندهید.

## وضعیت بهره‌برداری

پایگاه داده از نظر دسترسی ناشناس بسته است و Edge Function منتشر شده، اما سامانه هنوز عملیاتی نیست. تا زمان تأیید Secret، تست bootstrap و ورود، انتشار frontend و آزمون گردش‌کارهای اصلی، اطلاعات واقعی رانندگان را وارد نکنید.


## آماده‌سازی نصب (بازبینی تکمیلی)

- قابلیت PWA در `manifest.webmanifest` و ثبت Service Worker در `src/main.tsx` از قبل وجود داشت.
- پوسته آفلاین Service Worker به‌روزرسانی شد تا مسیر `/` نیز هنگام نصب cache شود؛ نام cache به v3 ارتقا یافت.
- فایل `vercel.json` برای cache کنترل‌شده Service Worker و هدرهای پایه امنیتی اضافه شد.
- راهنمای فارسی انتشار در Vercel و نصب PWA روی اندروید اضافه شد.
- این تغییرات هنوز به GitHub منتقل یا روی Vercel منتشر نشده‌اند.
- آزمون build در این محیط به دلیل ناقص بودن `node_modules` و timeout در دریافت وابستگی‌ها انجام نشد؛ موفقیت build هنوز تأیید نشده است.

- بازبینی نهایی بسته نصب: وجود آیکون‌های ۱۹۲، ۵۱۲ و Apple Touch تأیید شد؛ manifest به فایل‌ها اشاره می‌کند. برای پشتیبانی از مسیرهای سمت‌کاربر در Vercel، fallback به `index.html` اضافه شد.
- تلاش مجدد برای `npm ci` در محیط آماده‌سازی با timeout مواجه شد؛ Build همچنان تأییدنشده است.

## Production environment

The production build environment file `.env.production` is populated with this project's Supabase URL and its public publishable key (`sb_publishable_...`). This key is designed for browser use and is not a service-role secret. Never place a service-role key or `STAFF_REGISTRATION_CODE` in frontend files. Vercel can alternatively receive these two values as Environment Variables.


## Security follow-up — ۱۴۰۵/۰۸/۲۵

- Public staff registration in the repository source is now restricted to the \`expert\` role; manager accounts are provisioned only by an authenticated manager, apart from the one-time initial bootstrap.
- Public driver/staff registration no longer deletes an existing orphaned driver account to reuse its phone number.
- The deployed \`manage-staff\` Edge Function was inspected and is still on its previous version. The updated repository function must be deployed by the project owner before production use; this run did not modify the live function or read any secrets.
- Vehicle records are now sorted by taxi row number in ascending numeric order, including Persian and Arabic digits.
- The one-time ZIP import workflow was removed; the read-only CI workflow remains the repeatable quality gate.


## Secretariat and production blockers — ۱۴۰۵/۰۸/۲۵

- Migration \`20261116100000_harden_secretariat_workflow.sql\` has been added to the repository. It adds referral completion fields, recipient/manager completion permissions, atomic referral creation, manager-only final signing, and protection against editing/deleting signed letters.
- This migration has **not** been applied to the live Supabase project. Apply it only after reviewing the SQL and taking a backup; the updated Secretariat UI depends on these new columns and RPC.
- The live database currently has no profiles, Auth users, letters, referrals, or stored documents. The first manager account has not yet been created.
- Public driver registration still does not verify phone ownership with SMS/OTP and has no application-level rate limit. Add verified phone ownership and abuse throttling before accepting real driver identity data.
- The active deployed \`manage-staff\` function remains version 1. The repository has a safer source revision, but deployment to Supabase was intentionally left to the project owner.
- The repository has a PWA shell and icons; there is no Capacitor/Android project or tested APK yet.
