# آماده‌سازی انتشار وب و اندروید

## وب / PWA

- پروژه Pages: `talesh-taxi-system`
- شاخه Production در Cloudflare: `release/standalone-railway`
- Build: `npm ci && npm run build`
- خروجی: `dist`
- دامنه فعلی: `https://talesh-taxi-system.pages.dev`

انتشار وب از اتصال Git موجود در Cloudflare Pages انجام می‌شود. با push به شاخه Production، Cloudflare نسخه جدید را build و منتشر می‌کند. آدرس و کلید عمومی فعال Supabase به‌عنوان پیش‌فرض عمومی در برنامه تعریف شده‌اند؛ در صورت نیاز می‌توان آن‌ها را با متغیرهای محیطی Cloudflare بازنویسی کرد. هیچ service-role یا secret key در کد مرورگر قرار ندارد.

## Android APK

گردش‌کار `Android APK` به‌صورت خودکار در push به شاخه آماده‌سازی و در Pull Request به شاخه Production اجرا می‌شود. وب‌اپ را build می‌کند، پروژه Android را با Capacitor 7 تولید می‌کند و APK قابل نصب آزمایشی را به‌صورت Artifact در GitHub Actions ذخیره می‌کند. برای build آزمایشی به Secrets اضافی نیاز نیست؛ برنامه از کلید عمومی Supabase استفاده می‌کند.

این APK نسخه Debug و دارای امضای توسعه است؛ برای توزیع عمومی/نهایی مناسب نیست. برای نسخه Release باید keystore متعلق به سازمان به‌صورت امن در GitHub Secrets اضافه و workflow امضای Release تکمیل شود. فایل keystore یا رمز آن را در مخزن یا چت قرار ندهید.

## نصب PWA بدون APK

پس از انتشار معتبر روی HTTPS:
1. لینک `https://talesh-taxi-system.pages.dev` را در Chrome اندروید باز کنید.
2. از منوی مرورگر گزینه Install app یا Add to Home screen را بزنید.
3. ورود، نقش‌ها، بارگذاری فایل و عملکرد آفلاین را با حساب آزمایشی بررسی کنید.

## پیش‌نیازهای تحویل عملیاتی

- مدیر اولیه و حساب‌های ورود رانندگان باید به‌صورت امن راه‌اندازی شوند.
- RLS، نقش‌ها، Storage و تاریخچه migrationها باید در محیط پشتیبان/آزمایشی بررسی شوند.
- APK نهایی فقط پس از اجرای موفق workflow و نصب واقعی تأییدشده محسوب می‌شود.
