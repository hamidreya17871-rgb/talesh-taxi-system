# انتشار مستقل روی Cloudflare Pages

این پروژه یک برنامه Vite/React ایستا است و پایگاه داده و احراز هویت آن روی Supabase می‌ماند. برای انتشار رابط وب، نیازی به Railway یا سرور Node دائمی نیست.

## تنظیمات پروژه Pages

- Repository: `hamidreya17871-rgb/talesh-taxi-system`
- Production branch: `release/standalone-railway`
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: ریشه مخزن
- Environment variable: `NODE_VERSION=22`

## متغیرهای محیطی Production

این دو متغیر را در تنظیمات Pages وارد کنید:

- `VITE_SUPABASE_URL=https://xrhzsafezpwdztjytkob.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<Supabase publishable key beginning with sb_publishable_>`

کلید publishable/anon برای استفاده در مرورگر طراحی شده است و باید همراه با RLS و policyهای درست استفاده شود. هرگز کلید `service_role` یا `STAFF_REGISTRATION_CODE` را در Cloudflare Pages، متغیرهای `VITE_*`، مخزن Git یا کد مرورگر قرار ندهید.

## اتصال GitHub

1. در Cloudflare Dashboard وارد Workers & Pages شوید.
2. Create application را انتخاب و سپس Pages و Connect to Git را انتخاب کنید.
3. مخزن بالا را متصل کنید و تنظیمات بخش «تنظیمات پروژه Pages» را دقیق وارد کنید.
4. متغیرهای محیطی Production را اضافه کنید.
5. Save and Deploy را بزنید و تا پایان build صبر کنید.
6. پس از انتشار، آدرس `pages.dev` را باز کنید و ورود، ثبت‌نام راننده و کارکرد PWA را آزمایش کنید.

با هر push موفق به شاخه `release/standalone-railway`، Cloudflare Pages به‌طور خودکار نسخه جدید را build و منتشر می‌کند.

## وضعیت داده و حساب‌ها

- اطلاعات پایه ۱۱ راننده، ۱۱ خودرو و یک پروانه از فایل پشتیبان به پروژه Supabase منتقل شده‌اند.
- حساب‌های Auth و پروفایل مدیر/کارشناسان/رانندگان هنوز ایجاد نشده‌اند؛ ساخت مدیر اولیه از صفحه راه‌اندازی برنامه با شناسه سازمانی سمت سرور انجام می‌شود.
- فایل پیوست پروانه در فایل JSON پشتیبان وجود نداشت؛ مسیر فایل عمداً خالی مانده است.
- قبل از استفاده عملیاتی، حساب مدیر اولیه، نقش‌ها، RLS، ثبت‌نام راننده و بارگذاری/دریافت فایل باید با حساب‌های آزمایشی بررسی شوند.
- نسخه پشتیبان فایل‌های Storage در دسترس نبود؛ اسناد بایگانی و فایل‌های پیوست قدیمی بازیابی نشده‌اند.
