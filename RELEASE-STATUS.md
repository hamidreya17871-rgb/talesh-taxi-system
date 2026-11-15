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
