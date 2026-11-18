import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLES = ["admin", "manager", "expert", "driver"];
const STAFF_SIGNUP_ROLES = ["expert"];
const STAFF_REGISTRATION_CODE = Deno.env.get("STAFF_REGISTRATION_CODE") ?? "";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^09\d{9}$/;
const NATIONAL_CODE_PATTERN = /^\d{10}$/;
const PLATE_PATTERN = /^ایران [۰-۹]{2} - [۰-۹]{3} (الف|ب|پ|ت|ث|ج|د|ژ|س|ش|ص|ط|ع|ل|م|ن|و|ه|ی) [۰-۹]{2}$/;
const DISABLED_BAN = "876000h";
const PENDING_DRIVER_STATUS = "در انتظار بررسی";
const ACTIVE_DRIVER_STATUS = "فعال";
const INACTIVE_DRIVER_STATUS = "غیرفعال";
const GENERIC_ERROR = "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";

class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const admin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function invalid(): RequestError {
  return new RequestError("اطلاعات واردشده معتبر نیست.", 400);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key];
  if (typeof value !== "string") throw invalid();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw invalid();
  return trimmed;
}

function readPhone(body: Record<string, unknown>): string {
  const phone = readText(body, "phone", 11);
  if (!PHONE_PATTERN.test(phone)) {
    throw new RequestError("شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۳۴۵۶۷۸۹", 400);
  }
  return phone;
}

function phoneToAccountEmail(phone: string): string {
  return `${phone}@phone.talesh.app`;
}

function readPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) {
    throw new RequestError("رمز عبور باید بین ۸ تا ۷۲ نویسه باشد.", 400);
  }
  return value;
}

function readRole(body: Record<string, unknown>): string {
  const role = body.role;
  if (typeof role !== "string" || !ROLES.includes(role)) throw invalid();
  return role;
}

async function readDriverId(body: Record<string, unknown>, role: string): Promise<string | null> {
  if (role !== "driver") return null;
  const id = body.driver_id;
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    throw new RequestError("برای نقش راننده، پرونده راننده را انتخاب کنید.", 400);
  }
  const { data, error } = await admin.from("drivers").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new RequestError("پرونده راننده پیدا نشد.", 404);
  return id;
}

async function hasManager(): Promise<boolean> {
  const { count, error } = await admin
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "manager")
    .eq("is_active", true)
    .eq("approval_status", "approved");
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function requireStaff(req: Request, allowedRoles: string[]): Promise<string> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new RequestError("دسترسی مجاز نیست.", 401);
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role, is_active, approval_status")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile || !(allowedRoles.includes(profile.role) || (profile.role === "admin" && allowedRoles.includes("manager"))) || !profile.is_active || profile.approval_status !== "approved") {
    throw new RequestError("دسترسی مجاز نیست.", 403);
  }
  return userData.user.id;
}

async function requireOrganizationStaff(req: Request): Promise<string> {
  const userId = await requireStaff(req, ["manager", "expert"]);
  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_disciplinary_committee")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (profile?.is_disciplinary_committee) {
    throw new RequestError("این حساب فقط به کارتابل کمیته انضباطی دسترسی دارد.", 403);
  }
  return userId;
}

async function createAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      throw new RequestError("این شماره موبایل قبلاً ثبت شده است.", 409);
    }
    throw error;
  }
  return data.user.id;
}



type ProfileValues = {
  email: string;
  phone: string;
  full_name: string;
  role: string;
  driver_id: string | null;
  is_active: boolean;
  approval_status: "pending" | "approved";
};

async function insertProfile(userId: string, values: ProfileValues): Promise<void> {
  const { error } = await admin.from("profiles").insert({ user_id: userId, ...values });
  if (!error) return;
  await admin.auth.admin.deleteUser(userId);
  if (error.code === "23505") {
    throw new RequestError("این شماره موبایل یا پرونده راننده قبلاً ثبت شده است.", 409);
  }
  throw error;
}

async function handleBootstrap(body: Record<string, unknown>): Promise<Response> {
  if (!STAFF_REGISTRATION_CODE || body.registration_code !== STAFF_REGISTRATION_CODE) {
    throw new RequestError("شناسه راه‌اندازی سازمان معتبر نیست.", 403);
  }
  if (await hasManager()) throw new RequestError("امکان ثبت مدیر اولیه وجود ندارد.", 403);
  const phone = readPhone(body);
  const password = readPassword(body.password);
  const fullName = readText(body, "full_name", 100);
  const userId = await createAuthUser(phoneToAccountEmail(phone), password);
  await insertProfile(userId, {
    email: phoneToAccountEmail(phone),
    phone,
    full_name: fullName,
    role: "manager",
    driver_id: null,
    is_active: true,
    approval_status: "approved",
  });
  return json({ user_id: userId });
}

async function handleClaimInitialAdmin(req: Request): Promise<Response> {
  const callerId = await requireStaff(req, ["manager"]);
  const { data, error } = await admin.rpc("claim_initial_system_admin", { p_user_id: callerId });
  if (error) {
    if (error.message?.includes("already_exists")) {
      throw new RequestError("مدیرکل سامانه قبلاً تعیین شده است؛ ارتقای مجدد مجاز نیست.", 409);
    }
    if (error.message?.includes("manager_required")) {
      throw new RequestError("فقط حساب فعال مدیر سازمان می‌تواند مدیرکل اولیه شود.", 403);
    }
    if (error.message?.includes("manager_not_unique")) {
      throw new RequestError("برای جلوگیری از ارتقای حساب اشتباه، ابتدا باید فقط یک مدیر سازمان فعال باقی بماند.", 409);
    }
    throw error;
  }
  if (data !== true) throw new RequestError("ارتقای مدیرکل انجام نشد.", 409);
  return json({ user_id: callerId, role: "admin" });
}

async function handleCreate(req: Request, body: Record<string, unknown>): Promise<Response> {
  const callerId = await requireStaff(req, ["manager"]);
  const caller = await admin.from("profiles").select("role").eq("user_id", callerId).single();
  if (caller.error) throw caller.error;
  const phone = readPhone(body);
  const password = readPassword(body.password);
  const fullName = readText(body, "full_name", 100);
  const role = readRole(body);
  if (role === "admin") {
    throw new RequestError("ایجاد مدیرکل از فرم کاربران مجاز نیست؛ مدیرکل اولیه باید از مسیر امن راه‌اندازی تعیین شود.", 403);
  }
  if (role === "manager" && caller.data.role !== "admin") {
    throw new RequestError("ایجاد یا جایگزینی مدیر سازمان فقط در اختیار مدیرکل سامانه است.", 403);
  }
  const driverId = await readDriverId(body, role);
  const userId = await createAuthUser(phoneToAccountEmail(phone), password);
  await insertProfile(userId, {
    email: phoneToAccountEmail(phone),
    phone,
    full_name: fullName,
    role,
    driver_id: driverId,
    is_active: true,
    approval_status: "approved",
  });
  return json({ user_id: userId });
}

async function handleDeleteExpert(req: Request, body: Record<string, unknown>): Promise<Response> {
  const callerId = await requireStaff(req, ["manager"]);
  const userId = body.user_id;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) throw invalid();
  if (userId === callerId) throw new RequestError("شما نمی‌توانید حساب خود را حذف کنید.", 400);

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new RequestError("کاربر پیدا نشد.", 404);
  if (target.role !== "expert") throw new RequestError("فقط حساب کارشناس قابل حذف است.", 400);

  const { error: profileError } = await admin.from("profiles").delete().eq("user_id", userId);
  if (profileError) throw profileError;
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) throw authError;
  return json({ user_id: userId });
}

async function handleDeactivateDriver(req: Request, body: Record<string, unknown>): Promise<Response> {
  await requireStaff(req, ["manager"]);
  const userId = body.user_id;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) throw invalid();
  const reason = body.reason;
  const reasonLabels: Record<string, string> = {
    vehicle_sold: "فروش خودرو",
    retired: "بازنشستگی",
    ceased_activity: "قطع فعالیت",
  };
  if (typeof reason !== "string" || !Object.prototype.hasOwnProperty.call(reasonLabels, reason)) throw invalid();
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("user_id, role, driver_id, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "driver" || !profile.driver_id) {
    throw new RequestError("حساب راننده یا پرونده مرتبط پیدا نشد.", 404);
  }
  if (!profile.is_active) throw new RequestError("این حساب راننده قبلاً غیرفعال شده است.", 409);

  const { data: driver, error: driverError } = await admin.from("drivers")
    .select("id, notes")
    .eq("id", profile.driver_id)
    .maybeSingle();
  if (driverError) throw driverError;
  if (!driver) throw new RequestError("پرونده راننده پیدا نشد.", 404);

  const timestamp = new Date().toISOString();
  const status = reason === "vehicle_sold" ? "فروخته‌شده" : reason === "retired" ? "بازنشسته" : "قطع فعالیت";
  const auditLine = `\n[${timestamp}] خاتمه فعالیت: ${reasonLabels[reason]}.${note ? ` توضیحات: ${note}` : ""}`;
  const { error: driverUpdateError } = await admin.from("drivers")
    .update({ status, notes: `${driver.notes ?? ""}${auditLine}` })
    .eq("id", profile.driver_id);
  if (driverUpdateError) throw driverUpdateError;

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: DISABLED_BAN });
  if (banError) throw banError;
  const { error: profileUpdateError } = await admin.from("profiles")
    .update({ is_active: false })
    .eq("user_id", userId);
  if (profileUpdateError) throw profileUpdateError;

  return json({ user_id: userId, driver_id: profile.driver_id, status, vehicle_transfer_required: reason === "vehicle_sold" });
}

async function handleReactivateDriver(req: Request, body: Record<string, unknown>): Promise<Response> {
  await requireStaff(req, ["manager"]);
  const userId = body.user_id;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) throw invalid();

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("user_id, role, driver_id, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "driver" || !profile.driver_id) {
    throw new RequestError("حساب راننده یا پرونده مرتبط پیدا نشد.", 404);
  }
  if (profile.is_active) throw new RequestError("این حساب راننده در حال حاضر فعال است.", 409);

  const { data: driver, error: driverError } = await admin.from("drivers")
    .select("id, notes")
    .eq("id", profile.driver_id)
    .maybeSingle();
  if (driverError) throw driverError;
  if (!driver) throw new RequestError("پرونده راننده پیدا نشد.", 404);

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (banError) throw banError;
  const { error: profileUpdateError } = await admin.from("profiles")
    .update({ is_active: true, approval_status: "approved" })
    .eq("user_id", userId);
  if (profileUpdateError) throw profileUpdateError;
  const { error: driverUpdateError } = await admin.from("drivers")
    .update({
      status: "فعال",
      notes: `${driver.notes ?? ""}\n[${new Date().toISOString()}] فعال‌سازی مجدد راننده توسط مدیر سازمان.`,
    })
    .eq("id", profile.driver_id);
  if (driverUpdateError) throw driverUpdateError;

  return json({ user_id: userId, driver_id: profile.driver_id, status: "فعال" });
}

async function handleUpdate(req: Request, body: Record<string, unknown>): Promise<Response> {
  const callerId = await requireStaff(req, ["manager"]);
  const userId = body.user_id;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) throw invalid();

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new RequestError("کاربر پیدا نشد.", 404);

  const callerProfile = await admin.from("profiles").select("role").eq("user_id", callerId).single();
  if (callerProfile.error) throw callerProfile.error;
  const fullName = readText(body, "full_name", 100);
  const role = readRole(body);
  const driverId = await readDriverId(body, role);
  if (typeof body.is_active !== "boolean") throw invalid();
  const isActive = body.is_active;

  if (userId === callerId) throw new RequestError("تغییر نقش یا غیرفعال‌سازی حساب خودتان مجاز نیست.", 400);
  if (role === "admin" && target.role !== "admin") {
    throw new RequestError("تعیین مدیرکل فقط از مسیر امن ارتقای مدیر سازمان و در صورت نبود مدیرکل فعال امکان‌پذیر است.", 403);
  }
  if (target.role === "admin" && (role !== "admin" || !isActive)) {
    throw new RequestError("حساب یگانه مدیرکل از این بخش قابل تنزل یا غیرفعال‌سازی نیست.", 409);
  }
  if (role === "manager" && target.role !== "manager" && callerProfile.data.role !== "admin") {
    throw new RequestError("تعیین یا جایگزینی مدیر سازمان فقط در اختیار مدیرکل سامانه است.", 403);
  }
  if (target.role === "manager" && callerProfile.data.role !== "admin" && (role !== "manager" || !isActive)) {
    throw new RequestError("تغییر نقش یا غیرفعال‌سازی مدیر سازمان فقط برای مدیرکل مجاز است.", 403);
  }
  if (target.role === "manager" && (role !== "manager" || !isActive)) {
    const { count, error } = await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "manager").eq("is_active", true).eq("approval_status", "approved");
    if (error) throw error;
    if ((count ?? 0) <= 1) throw new RequestError("تنزل یا غیرفعال‌سازی آخرین مدیر سازمان مجاز نیست.", 409);
  }
  if (role === "admin" && callerProfile.data.role !== "admin") {
    const { count, error } = await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true).eq("approval_status", "approved");
    if (error) throw error;
    if ((count ?? 0) > 0) throw new RequestError("تعیین مدیرکل جدید فقط با تأیید مدیرکل فعلی مجاز است.", 403);
  }

  if (body.password) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: readPassword(body.password) });
    if (error) throw error;
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? "none" : DISABLED_BAN,
  });
  if (banError) throw banError;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ full_name: fullName, role, driver_id: driverId, is_active: isActive, approval_status: "approved" })
    .eq("user_id", userId);
  if (updateError) {
    if (updateError.code === "23505") {
      throw new RequestError("این پرونده راننده قبلاً به حساب دیگری متصل شده است.", 409);
    }
    throw updateError;
  }
  return json({ user_id: userId });
}

async function handleRegisterStaff(body: Record<string, unknown>): Promise<Response> {
  if (!STAFF_REGISTRATION_CODE || body.registration_code !== STAFF_REGISTRATION_CODE) {
    throw new RequestError("شناسه ثبت‌نام معتبر نیست.", 403);
  }
  const phone = readPhone(body);
  const password = readPassword(body.password);
  const fullName = readText(body, "full_name", 100);
  const role = body.role;
  if (typeof role !== "string" || !STAFF_SIGNUP_ROLES.includes(role)) throw invalid();

  const email = phoneToAccountEmail(phone);
  const userId = await createAuthUser(email, password);
  await insertProfile(userId, {
    email,
    phone,
    full_name: fullName,
    role,
    driver_id: null,
    is_active: true,
    approval_status: "approved",
  });
  return json({ user_id: userId });
}

async function handleRegisterDriver(req: Request, body: Record<string, unknown>): Promise<Response> {
  const phone = readPhone(body);
  const clientIp = req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const ipHash = await sha256Hex(clientIp);
  const { data: registrationAllowed, error: rateLimitError } = await admin
    .rpc("allow_driver_registration", { p_phone: phone, p_ip_hash: ipHash });
  if (rateLimitError) throw rateLimitError;
  if (registrationAllowed !== true) {
    throw new RequestError("تعداد درخواست‌های ثبت‌نام از این شماره یا اتصال زیاد است. یک ساعت دیگر دوباره تلاش کنید.", 429);
  }
  const password = readPassword(body.password);
  const fullName = readText(body, "full_name", 100);
  const nationalCode = readText(body, "national_code", 10);
  if (!NATIONAL_CODE_PATTERN.test(nationalCode)) {
    throw new RequestError("کد ملی باید ۱۰ رقم باشد.", 400);
  }
  const plate = readText(body, "plate", 40);
  if (!PLATE_PATTERN.test(plate)) throw new RequestError("شماره پلاک معتبر نیست.", 400);
  const model = readText(body, "model", 100);
  const taxiRowNo = readText(body, "taxi_row_no", 20);

  const email = phoneToAccountEmail(phone);
  const [driverByPhone, driverByNationalCode, profileByPhone, vehicleByPlate, vehicleByTaxiRow] = await Promise.all([
    admin.from("drivers").select("id").eq("phone", phone).maybeSingle(),
    admin.from("drivers").select("id").eq("national_code", nationalCode).maybeSingle(),
    admin.from("profiles").select("user_id").eq("phone", phone).maybeSingle(),
    admin.from("vehicles").select("id, driver_id").eq("plate", plate).maybeSingle(),
    admin.from("vehicles").select("id, driver_id").eq("taxi_row_no", taxiRowNo).maybeSingle(),
  ]);
  for (const result of [driverByPhone, driverByNationalCode, profileByPhone, vehicleByPlate, vehicleByTaxiRow]) {
    if (result.error) throw result.error;
  }

  let existingDriverId: string | null = null;
  let existingVehicleId: string | null = null;
  if (driverByPhone.data || driverByNationalCode.data) {
    if (!driverByPhone.data || !driverByNationalCode.data
      || driverByPhone.data.id !== driverByNationalCode.data.id) {
      throw new RequestError("شماره موبایل و کد ملی با یک پرونده راننده واحد مطابقت ندارند.", 409);
    }
    existingDriverId = driverByPhone.data.id;
    if (profileByPhone.data) {
      throw new RequestError("برای این شماره موبایل قبلاً حساب کاربری ثبت شده است.", 409);
    }

    const [profileByDriver, existingVehicles] = await Promise.all([
      admin.from("profiles").select("user_id").eq("driver_id", existingDriverId).limit(1).maybeSingle(),
      admin.from("vehicles").select("id, plate, taxi_row_no").eq("driver_id", existingDriverId),
    ]);
    if (profileByDriver.error) throw profileByDriver.error;
    if (existingVehicles.error) throw existingVehicles.error;
    if (profileByDriver.data) {
      throw new RequestError("برای این پرونده راننده قبلاً حساب کاربری ایجاد شده است.", 409);
    }

    if (existingVehicles.data.length > 0) {
      const matchingVehicle = existingVehicles.data.find(vehicle =>
        normalizeDigits(vehicle.plate) === normalizeDigits(plate)
        && normalizeDigits(vehicle.taxi_row_no ?? "") === normalizeDigits(taxiRowNo)
      );
      if (!matchingVehicle) {
        throw new RequestError("پلاک یا ردیف تاکسی با پرونده موجود مطابقت ندارد؛ با مدیر سازمان تماس بگیرید.", 409);
      }
      if ((vehicleByPlate.data && vehicleByPlate.data.id !== matchingVehicle.id)
        || (vehicleByTaxiRow.data && vehicleByTaxiRow.data.id !== matchingVehicle.id)) {
        throw new RequestError("پلاک یا ردیف تاکسی به پرونده دیگری تعلق دارد.", 409);
      }
      existingVehicleId = matchingVehicle.id;
    } else if (vehicleByPlate.data || vehicleByTaxiRow.data) {
      throw new RequestError("پلاک یا ردیف تاکسی قبلاً در پرونده دیگری ثبت شده است.", 409);
    }
  } else if (profileByPhone.data || vehicleByPlate.data || vehicleByTaxiRow.data) {
    throw new RequestError("شماره موبایل، پلاک یا ردیف تاکسی قبلاً ثبت شده است.", 409);
  }

  const userId = await createAuthUser(email, password);
  let driverId = existingDriverId;
  let createdDriverId: string | null = null;
  let createdVehicleId: string | null = null;
  try {
    if (!driverId) {
      const { data: driver, error: driverError } = await admin
        .from("drivers")
        .insert({ name: fullName, national_code: nationalCode, phone, status: PENDING_DRIVER_STATUS })
        .select("id")
        .single();
      if (driverError) throw driverError;
      driverId = driver.id;
      createdDriverId = driver.id;
    }

    if (!existingVehicleId) {
      const { data: vehicle, error: vehicleError } = await admin.from("vehicles").insert({
        plate,
        model,
        driver_name: fullName,
        taxi_row_no: taxiRowNo,
        driver_id: driverId,
        status: "نیازمند بررسی",
      }).select("id").single();
      if (vehicleError) throw vehicleError;
      createdVehicleId = vehicle.id;
    }

    await insertProfile(userId, {
      email,
      phone,
      full_name: fullName,
      role: "driver",
      driver_id: driverId,
      is_active: false,
      approval_status: "pending",
    });
  } catch (error) {
    if (createdVehicleId) await admin.from("vehicles").delete().eq("id", createdVehicleId);
    if (createdDriverId) await admin.from("drivers").delete().eq("id", createdDriverId);
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
  return json({ user_id: userId, linked_existing_driver: Boolean(existingDriverId) });
}



function normalizeDigits(value: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹", arabic = "٠١٢٣٤٥٦٧٨٩";
  return value.split("").map(char => {
    const p = persian.indexOf(char); if (p >= 0) return String(p);
    const a = arabic.indexOf(char); if (a >= 0) return String(a);
    return char;
  }).join("");
}
function randomUrlToken(bytes = 24): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = ""; for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function handlePermanentlyDeleteArchivedLetter(req: Request, body: Record<string, unknown>): Promise<Response> {
  const actorId = await requireStaff(req, ["manager"]);
  const letterId = body.letter_id;
  if (typeof letterId !== "string" || !UUID_PATTERN.test(letterId)) throw invalid();

  const { data, error } = await admin.rpc("permanently_delete_archived_letter", { p_letter_id: letterId, p_actor_id: actorId });
  if (error) {
    if (error.message.includes("سطل بازیافت")) throw new RequestError("نامه در سطل بازیافت پیدا نشد یا قبلاً حذف شده است.", 404);
    if (error.message.includes("دسترسی") || error.code === "42501") throw new RequestError("حذف دائمی فقط برای مدیر سازمان مجاز است.", 403);
    throw error;
  }

  const paths = isRecord(data) && Array.isArray(data.storage_paths)
    ? data.storage_paths.filter((path): path is string => typeof path === "string" && path.length > 0)
    : [];
  let filesCleaned = true;
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from("archive-documents").remove([...new Set(paths)]);
    filesCleaned = !storageError;
    if (storageError) console.error("Archived letter storage cleanup failed", storageError);
  }

  return json({
    deleted: true,
    letter_no: isRecord(data) ? data.letter_no : null,
    files_cleaned: filesCleaned,
    cleanup_warning: filesCleaned ? null : "سجل نامه حذف شد اما پاک‌سازی یک یا چند فایل پیوست ناموفق بود؛ مسیر فایل‌ها در سابقه حذف ثبت شده است.",
  });
}

async function handleCreateSingleDriver(req: Request, body: Record<string, unknown>): Promise<Response> {
  await requireStaff(req, ["manager"]);
  const phone = readPhone(body);
  const nationalCode = normalizeDigits(readText(body, "national_code", 10));
  if (!NATIONAL_CODE_PATTERN.test(nationalCode)) throw new RequestError("کد ملی باید ۱۰ رقم باشد.", 400);
  const fullName = readText(body, "full_name", 100);
  const plate = readText(body, "plate", 40);
  if (!PLATE_PATTERN.test(plate)) throw new RequestError("شماره پلاک معتبر نیست.", 400);
  const model = readText(body, "model", 100);
  const taxiRowNo = normalizeDigits(readText(body, "taxi_row_no", 20));
  const [driverPhone, driverNational, profilePhone, vehiclePlate, vehicleRow] = await Promise.all([
    admin.from("drivers").select("id").eq("phone", phone).maybeSingle(),
    admin.from("drivers").select("id").eq("national_code", nationalCode).maybeSingle(),
    admin.from("profiles").select("user_id").eq("phone", phone).maybeSingle(),
    admin.from("vehicles").select("id").eq("plate", plate).maybeSingle(),
    admin.from("vehicles").select("id").eq("taxi_row_no", taxiRowNo).maybeSingle(),
  ]);
  for (const result of [driverPhone, driverNational, profilePhone, vehiclePlate, vehicleRow]) {
    if (result.error) throw result.error;
  }
  if (driverPhone.data || driverNational.data || profilePhone.data || vehiclePlate.data || vehicleRow.data) {
    throw new RequestError("شماره موبایل، کد ملی، پلاک یا ردیف تاکسی قبلاً ثبت شده است.", 409);
  }

  const email = phoneToAccountEmail(phone);
  const userId = await createAuthUser(email, randomUrlToken(32));
  let driverId: string | null = null;
  try {
    const driver = await admin.from("drivers").insert({
      name: fullName, national_code: nationalCode, phone, status: PENDING_DRIVER_STATUS,
    }).select("id").single();
    if (driver.error) throw driver.error;
    driverId = driver.data.id;

    const vehicle = await admin.from("vehicles").insert({
      plate, model, driver_name: fullName, taxi_row_no: taxiRowNo,
      driver_id: driverId, status: "نیازمند بررسی",
    });
    if (vehicle.error) throw vehicle.error;

    const profile = await admin.from("profiles").insert({
      user_id: userId, email, phone, full_name: fullName, role: "driver",
      driver_id: driverId, is_active: false, approval_status: "pending",
    });
    if (profile.error) throw profile.error;

    const activationCode = randomUrlToken(24);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await admin.rpc("store_driver_activation_token", {
      p_user_id: userId, p_code_hash: await sha256Hex(activationCode), p_expires_at: expiresAt,
    });
    if (tokenError) throw tokenError;
    return json({ name: fullName, phone, activation_code: activationCode, expires_at: expiresAt });
  } catch (error) {
    await admin.from("profiles").delete().eq("user_id", userId);
    if (driverId) {
      await admin.from("vehicles").delete().eq("driver_id", driverId);
      await admin.from("drivers").delete().eq("id", driverId);
    }
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

async function handleIssueExistingDriverCodes(req: Request): Promise<Response> {
  await requireStaff(req, ["manager"]);
  const { data: drivers, error: driversError } = await admin
    .from("drivers")
    .select("id, name, phone, status")
    .not("phone", "is", null)
    .order("name", { ascending: true });
  if (driversError) throw driversError;

  const issued: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  for (const driver of drivers ?? []) {
    const phone = typeof driver.phone === "string" ? normalizeDigits(driver.phone).trim() : "";
    const fullName = typeof driver.name === "string" && driver.name.trim() ? driver.name.trim() : "راننده";
    if (driver.status !== ACTIVE_DRIVER_STATUS) {
      skipped.push({ name: fullName, phone, reason: "وضعیت پرونده راننده فعال نیست؛ کد بازیابی صادر نشد." });
      continue;
    }
    if (!PHONE_PATTERN.test(phone)) {
      skipped.push({ name: fullName, reason: "شماره موبایل معتبر ثبت نشده است." });
      continue;
    }

    const { data: existing, error: existingError } = await admin
      .from("profiles")
      .select("user_id, role, is_active, approval_status, driver_id")
      .or(`driver_id.eq.${driver.id},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    let userId: string;
    let createdUser = false;
    if (existing) {
      if (existing.role !== "driver" || existing.approval_status === "rejected" || (existing.driver_id && existing.driver_id !== driver.id)) {
        skipped.push({ name: fullName, phone, reason: "برای این راننده پرونده ناسازگار یا درخواست ردشده وجود دارد." });
        continue;
      }
      userId = existing.user_id;
      if (!existing.driver_id) {
        const { error: linkError } = await admin.from("profiles")
          .update({ driver_id: driver.id, full_name: fullName })
          .eq("user_id", userId);
        if (linkError) {
          skipped.push({ name: fullName, phone, reason: "اتصال حساب به پرونده راننده انجام نشد." });
          continue;
        }
      }
    } else {
      const email = phoneToAccountEmail(phone);
      const created = await admin.auth.admin.createUser({
        email,
        password: randomUrlToken(32),
        email_confirm: true,
      });
      if (created.error) {
        skipped.push({ name: fullName, phone, reason: "حسابی با این شماره قبلاً ایجاد شده یا ساخت حساب ممکن نیست." });
        continue;
      }
      userId = created.data.user.id;
      createdUser = true;
      const { error: profileError } = await admin.from("profiles").insert({
        user_id: userId,
        email,
        phone,
        full_name: fullName,
        role: "driver",
        driver_id: driver.id,
        is_active: false,
        approval_status: "approved",
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        skipped.push({ name: fullName, phone, reason: "اتصال حساب به پرونده راننده انجام نشد." });
        continue;
      }
    }

    const activationCode = randomUrlToken(24);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await admin.rpc("store_driver_activation_token", {
      p_user_id: userId,
      p_code_hash: await sha256Hex(activationCode),
      p_expires_at: expiresAt,
    });
    if (tokenError) {
      if (createdUser) {
        await admin.from("profiles").delete().eq("user_id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
      skipped.push({ name: fullName, phone, reason: "ساخت کد فعال‌سازی انجام نشد." });
      continue;
    }
    issued.push({ name: fullName, phone, activation_code: activationCode, expires_at: expiresAt });
  }
  return json({ issued, skipped, issued_count: issued.length, skipped_count: skipped.length });
}

async function handleImportDrivers(req: Request, body: Record<string, unknown>): Promise<Response> {
  await requireStaff(req, ["manager"]);
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 50) {
    throw new RequestError("هر بار باید بین ۱ تا ۵۰ راننده وارد شود.", 400);
  }
  const imported: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  for (let index = 0; index < body.records.length; index++) {
    const raw = body.records[index];
    if (!isRecord(raw)) { skipped.push({ row: index + 2, reason: "ساختار ردیف معتبر نیست." }); continue; }
    const row = { ...raw };
    for (const key of ["phone", "national_code", "taxi_row_no"]) {
      if (typeof row[key] === "string") row[key] = normalizeDigits(row[key] as string).trim();
    }
    let userId: string | null = null, driverId: string | null = null;
    try {
      const phone = readPhone(row);
      const nationalCode = readText(row, "national_code", 10);
      if (!NATIONAL_CODE_PATTERN.test(nationalCode)) throw new RequestError("کد ملی باید ۱۰ رقم باشد.", 400);
      const fullName = readText(row, "full_name", 100);
      const plate = readText(row, "plate", 40);
      const model = readText(row, "model", 100);
      const taxiRowNo = readText(row, "taxi_row_no", 20);
      const email = phoneToAccountEmail(phone);
      const [profileByPhone, driverByPhone, driverByNationalCode, vehicleByPlate, vehicleByTaxiRow] = await Promise.all([
        admin.from("profiles").select("user_id").eq("phone", phone).limit(1).maybeSingle(),
        admin.from("drivers").select("id").eq("phone", phone).limit(1).maybeSingle(),
        admin.from("drivers").select("id").eq("national_code", nationalCode).limit(1).maybeSingle(),
        admin.from("vehicles").select("id").eq("plate", plate).limit(1).maybeSingle(),
        admin.from("vehicles").select("id").eq("taxi_row_no", taxiRowNo).limit(1).maybeSingle(),
      ]);
      for (const result of [profileByPhone, driverByPhone, driverByNationalCode, vehicleByPlate, vehicleByTaxiRow]) {
        if (result.error) throw result.error;
      }
      if (profileByPhone.data || driverByPhone.data || driverByNationalCode.data || vehicleByPlate.data || vehicleByTaxiRow.data) {
        skipped.push({ row: index + 2, full_name: fullName, phone, reason: "شماره موبایل، کد ملی، پلاک یا ردیف تاکسی تکراری است." });
        continue;
      }
      const user = await admin.auth.admin.createUser({
        email, password: randomUrlToken(32), email_confirm: true,
      });
      if (user.error) {
        if (user.error.message.toLowerCase().includes("already")) {
          skipped.push({ row: index + 2, full_name: fullName, phone, reason: "برای این شماره قبلاً حساب کاربری ساخته شده است." });
          continue;
        }
        throw user.error;
      }
      userId = user.data.user.id;
      const driver = await admin.from("drivers").insert({
        name: fullName, national_code: nationalCode, phone, status: PENDING_DRIVER_STATUS,
      }).select("id").single();
      if (driver.error) throw driver.error;
      driverId = driver.data.id;
      const vehicle = await admin.from("vehicles").insert({
        plate, model, driver_name: fullName, taxi_row_no: taxiRowNo,
        driver_id: driverId, status: "نیازمند بررسی",
      });
      if (vehicle.error) throw vehicle.error;
      const activationCode = randomUrlToken(24);
      const codeHash = await sha256Hex(activationCode);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const profile = await admin.from("profiles").insert({
        user_id: userId, email, phone, full_name: fullName, role: "driver",
        driver_id: driverId, is_active: false, approval_status: "pending",
      });
      if (profile.error) throw profile.error;
      const { error: tokenError } = await admin.rpc("store_driver_activation_token", {
        p_user_id: userId, p_code_hash: codeHash, p_expires_at: expiresAt,
      });
      if (tokenError) throw tokenError;
      imported.push({ row: index + 2, full_name: fullName, phone, activation_code: activationCode, expires_at: expiresAt });
      userId = null; driverId = null;
    } catch (error) {
      if (userId) {
        await admin.from("profiles").delete().eq("user_id", userId);
        if (driverId) {
          await admin.from("vehicles").delete().eq("driver_id", driverId);
          await admin.from("drivers").delete().eq("id", driverId);
        }
        await admin.auth.admin.deleteUser(userId);
      }
      skipped.push({ row: index + 2, reason: error instanceof RequestError ? error.message : "ثبت این ردیف انجام نشد؛ اطلاعات آن را بررسی کنید." });
    }
  }
  return json({ imported, skipped, imported_count: imported.length, skipped_count: skipped.length });
}
async function handleActivateImportedDriver(body: Record<string, unknown>): Promise<Response> {
  const phone = readPhone(body);
  const code = readText(body, "activation_code", 64);
  if (!/^[A-Za-z0-9_-]{32}$/.test(code)) throw new RequestError("کد فعال‌سازی معتبر نیست.", 400);
  const password = readPassword(body.password);
  const nationalCode = normalizeDigits(readText(body, "national_code", 10));
  if (!NATIONAL_CODE_PATTERN.test(nationalCode)) throw new RequestError("کد ملی باید ۱۰ رقم باشد.", 400);
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("user_id, role, approval_status, driver_id").eq("phone", phone).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "driver" || profile.approval_status === "rejected" || !profile.driver_id) {
    throw new RequestError("پرونده راننده یا درخواست فعال‌سازی پیدا نشد.", 404);
  }
  const { data: driver, error: driverError } = await admin.from("drivers")
    .select("national_code").eq("id", profile.driver_id).maybeSingle();
  if (driverError) throw driverError;
  if (!driver || normalizeDigits(String(driver.national_code ?? "")) !== nationalCode) {
    throw new RequestError("کد ملی با پرونده راننده مطابقت ندارد.", 403);
  }
  const codeHash = await sha256Hex(code);
  const { data: consumed, error: consumeError } = await admin.rpc("consume_driver_activation_token", {
    p_user_id: profile.user_id, p_code_hash: codeHash,
  });
  if (consumeError) throw consumeError;
  if (consumed !== true) throw new RequestError("کد فعال‌سازی نادرست، منقضی یا قبلاً استفاده شده است.", 400);
  const { error: updateError } = await admin.auth.admin.updateUserById(profile.user_id, { password });
  if (updateError) throw updateError;
  if (profile.approval_status === "approved") {
    const { error: activationError } = await admin.from("profiles")
      .update({ is_active: true })
      .eq("user_id", profile.user_id);
    if (activationError) throw activationError;
  }
  return json({ activated: true, approval_status: profile.approval_status });
}

async function handleSaveSignature(req: Request, body: Record<string, unknown>): Promise<Response> {
  const userId = await requireStaff(req, ["manager", "expert"]);
  const signature = body.signature_data_url;
  if (typeof signature !== "string" || signature.length > 120000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(signature)) {
    throw invalid();
  }
  const { error } = await admin.from("profiles").update({ signature_data_url: signature }).eq("user_id", userId);
  if (error) throw error;
  return json({ saved: true });
}

async function handleListStaff(req: Request): Promise<Response> {
  await requireOrganizationStaff(req);
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, full_name, role, signature_data_url")
    .in("role", ["admin", "manager", "expert"])
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return json({ items: data ?? [] });
}

async function handleListRegistrations(req: Request): Promise<Response> {
  await requireOrganizationStaff(req);
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("user_id, phone, full_name, driver_id, created_at")
    .eq("role", "driver")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!profiles || profiles.length === 0) return json({ items: [] });

  const driverIds = profiles.map(profile => profile.driver_id).filter((id): id is string => typeof id === "string");
  const [driversResult, vehiclesResult] = await Promise.all([
    admin.from("drivers").select("id, national_code").in("id", driverIds),
    admin.from("vehicles").select("driver_id, plate, model, taxi_row_no").in("driver_id", driverIds),
  ]);
  if (driversResult.error) throw driversResult.error;
  if (vehiclesResult.error) throw vehiclesResult.error;

  const items = profiles.map(profile => {
    const driver = driversResult.data.find((row: { id: string }) => row.id === profile.driver_id);
    const vehicle = vehiclesResult.data.find((row: { driver_id: string }) => row.driver_id === profile.driver_id);
    return {
      user_id: profile.user_id,
      full_name: profile.full_name,
      phone: profile.phone ?? "",
      national_code: driver?.national_code ?? "",
      plate: vehicle?.plate ?? "",
      model: vehicle?.model ?? "",
      taxi_row_no: vehicle?.taxi_row_no ?? "",
      created_at: profile.created_at,
    };
  });
  return json({ items });
}

async function handleReviewRegistration(req: Request, body: Record<string, unknown>): Promise<Response> {
  await requireOrganizationStaff(req);
  const userId = body.user_id;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) throw invalid();
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") throw invalid();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, approval_status, driver_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "driver" || profile.approval_status !== "pending") {
    throw new RequestError("این درخواست دیگر در انتظار بررسی نیست.", 400);
  }

  const approved = decision === "approve";
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: approved ? "none" : DISABLED_BAN,
  });
  if (banError) throw banError;

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ is_active: approved, approval_status: approved ? "approved" : "rejected" })
    .eq("user_id", userId);
  if (profileUpdateError) throw profileUpdateError;

  if (profile.driver_id) {
    const { error: driverError } = await admin
      .from("drivers")
      .update({ status: approved ? ACTIVE_DRIVER_STATUS : INACTIVE_DRIVER_STATUS })
      .eq("id", profile.driver_id);
    if (driverError) throw driverError;
  }
  return json({ user_id: userId });
}


async function handleBulkReviewRegistrations(req: Request, body: Record<string, unknown>): Promise<Response> {
  await requireOrganizationStaff(req);
  if (!Array.isArray(body.user_ids) || body.user_ids.length < 1 || body.user_ids.length > 100) {
    throw new RequestError("برای بررسی گروهی باید بین ۱ تا ۱۰۰ درخواست انتخاب شود.", 400);
  }
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") throw invalid();
  const ids = [...new Set(body.user_ids.filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id)))];
  const results: Array<{ user_id: string; success: boolean; error?: string }> = [];
  for (const userId of ids) {
    const response = await handleReviewRegistration(req, { user_id: userId, decision });
    const payload = await response.json().catch(() => ({}));
    results.push(response.ok
      ? { user_id: userId, success: true }
      : { user_id: userId, success: false, error: typeof payload.error === "string" ? payload.error : GENERIC_ERROR });
  }
  return json({
    results,
    success_count: results.filter(item => item.success).length,
    failed_count: results.filter(item => !item.success).length,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body: unknown = await req.json();
    if (!isRecord(body)) throw invalid();

    switch (body.action) {
      case "needs-setup":
        return json({ needsSetup: !(await hasManager()) });
      case "bootstrap":
        return await handleBootstrap(body);
      case "claim-initial-admin":
        return await handleClaimInitialAdmin(req);
      case "create":
        return await handleCreate(req, body);
      case "update":
        return await handleUpdate(req, body);
      case "delete-expert":
        return await handleDeleteExpert(req, body);
      case "deactivate-driver":
        return await handleDeactivateDriver(req, body);
      case "reactivate-driver":
        return await handleReactivateDriver(req, body);
      case "register-driver":
        return await handleRegisterDriver(req, body);
      case "permanently-delete-archived-letter":
        return await handlePermanentlyDeleteArchivedLetter(req, body);
      case "create-driver-single":
        return await handleCreateSingleDriver(req, body);
      case "issue-existing-driver-codes":
        return await handleIssueExistingDriverCodes(req);
      case "import-drivers":
        return await handleImportDrivers(req, body);
      case "activate-imported-driver":
        return await handleActivateImportedDriver(body);
      case "register-staff":
        return await handleRegisterStaff(body);
      case "list-registrations":
        return await handleListRegistrations(req);
      case "list-staff":
        return await handleListStaff(req);
      case "save-signature":
        return await handleSaveSignature(req, body);
      case "review-registration":
        return await handleReviewRegistration(req, body);
      case "review-registrations":
        return await handleBulkReviewRegistrations(req, body);
      default:
        throw new RequestError("درخواست نامعتبر است.", 400);
    }
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    console.error("manage-staff failed", error);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
