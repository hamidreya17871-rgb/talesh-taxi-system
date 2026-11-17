# آماده‌سازی انتشار وب و اندروید

## وب / PWA

- پروژه Pages: `talesh-taxi-system`
- شاخه Production در Cloudflare: `release/standalone-railway`
- Build: `npm ci && npm run build`
- خروجی: `dist`
- دامنه فعلی: `https://talesh-taxi-system.pages.dev`

برای انتشار خودکار از GitHub Actions، این Secrets را در مخزن ثبت کنید:
- `VITE_SUPABASE_URL`: آدرس پروژه Supabase
- `VITE_SUPABASE_ANON_KEY`: کلید عمومی publishable/anon؛ هرگز service-role نباشد
- `CLOUDFLARE_API_TOKEN`: توکن محدود به Cloudflare Pages با مجوز Deploy
- `CLOUDFLARE_ACCOUNT_ID`: شناسه حساب Cloudflare

پس از ادغام این شاخه در `release/standalone-railway`، گردش‌کار Deploy وب اجرا می‌شود. انتشار موفق فقط پس از مشاهده نتیجه سبز GitHub Actions و باز کردن دامنه زنده تأیید می‌شود.

## Android APK

گردش‌کار `Android APK` پس از push به این شاخه، وب‌اپ را build کرده و پروژه Android را به‌صورت موقت با Capacitor 7 تولید می‌کند. فایل `app-debug.apk` به‌عنوان Artifact در GitHub Actions ذخیره می‌شود و برای نصب آزمایشی روی دستگاه Android قابل استفاده است.

این APK نسخه Debug و دارای امضای توسعه است؛ برای توزیع عمومی/نهایی مناسب نیست. برای نسخه Release باید keystore متعلق به سازمان به‌صورت امن در GitHub Secrets اضافه و workflow امضای Release تکمیل شود. فایل keystore یا رمز آن را در مخزن یا چت قرار ندهید.

## نصب PWA بدون APK

پس از انتشار روی HTTPS:
1. لینک `https://talesh-taxi-system.pages.dev` را در Chrome اندروید باز کنید.
2. از منوی مرورگر گزینه Install app یا Add to Home screen را بزنید.
3. پس از نصب، ورود و نقش‌ها را با حساب‌های آزمایشی بررسی کنید.

## محدودیت‌های قبل از بهره‌برداری

- کلیدهای عمومی Supabase باید به‌صورت GitHub Actions Secrets تنظیم شوند.
- ساخت APK و انتشار وب تا اجرای واقعی workflowها تأییدشده محسوب نمی‌شوند.
- مدیر اولیه و حساب‌های ورود رانندگان هنوز نیازمند راه‌اندازی امن هستند.
- پیش از استفاده عملیاتی، سیاست‌های Supabase و تاریخچه migrationها باید در محیط پشتیبان/آزمایشی بررسی شوند.
