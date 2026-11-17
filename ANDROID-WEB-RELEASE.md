# آماده‌سازی انتشار وب و اندروید

## وب / PWA

- پروژه Pages: `talesh-taxi-system`
- شاخه Production در Cloudflare: `release/standalone-railway`
- Build: `npm ci && npm run build`
- خروجی: `dist`
- دامنه فعلی: `https://talesh-taxi-system.pages.dev`

انتشار وب از اتصال Git موجود در Cloudflare Pages انجام می‌شود؛ گردش‌کار تکراری Deploy در GitHub حذف شده تا دو سیستم هم‌زمان روی Production ننویسند. با push به شاخه Production، Cloudflare همان build تعریف‌شده را منتشر می‌کند.

در تنظیمات Production خود Cloudflare باید `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` و `VITE_PWA_HOSTS` مقدار معتبر داشته باشند. اگر تنظیمات Supabase خالی باشند، برنامه به‌جای صفحه سفید پیام راهنمای پیکربندی نمایش می‌دهد.

## Android APK

گردش‌کار `Android APK` پس از push به شاخه آماده‌سازی، وب‌اپ را build کرده و پروژه Android را با Capacitor 7 تولید می‌کند. فایل `app-debug.apk` به‌عنوان Artifact در GitHub Actions ذخیره می‌شود و برای نصب آزمایشی روی Android قابل استفاده است.

برای build اندروید، دو GitHub Actions Secret زیر لازم است:
- `VITE_SUPABASE_URL`: آدرس پروژه Supabase
- `VITE_SUPABASE_ANON_KEY`: کلید عمومی publishable/anon؛ هرگز service-role نباشد

این APK نسخه Debug و دارای امضای توسعه است؛ برای توزیع عمومی/نهایی مناسب نیست. برای نسخه Release باید keystore متعلق به سازمان به‌صورت امن در GitHub Secrets اضافه و workflow امضای Release تکمیل شود. فایل keystore یا رمز آن را در مخزن یا چت قرار ندهید.

## نصب PWA بدون APK

پس از انتشار معتبر روی HTTPS:
1. لینک `https://talesh-taxi-system.pages.dev` را در Chrome اندروید باز کنید.
2. از منوی مرورگر گزینه Install app یا Add to Home screen را بزنید.
3. ورود، نقش‌ها، بارگذاری فایل و عملکرد آفلاین را با حساب آزمایشی بررسی کنید.

## پیش‌نیازهای تحویل عملیاتی

- مدیر اولیه و حساب‌های ورود رانندگان باید به‌صورت امن راه‌اندازی شوند.
- RLS، نقش‌ها، Storage و تاریخچه migrationها باید در محیط پشتیبان/آزمایشی بررسی شوند.
- ساخت APK و انتشار نهایی فقط پس از اجرای موفق workflow و نصب واقعی تأییدشده محسوب می‌شوند.
