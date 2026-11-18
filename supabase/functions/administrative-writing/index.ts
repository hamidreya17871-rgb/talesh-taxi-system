import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "روش درخواست مجاز نیست." }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!apiKey || !supabaseUrl || !anonKey) {
    return json({ error: "سرویس نگارش هوشمند هنوز پیکربندی نشده است." }, 503);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(authorization)) return json({ error: "ورود معتبر الزامی است." }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "نشست کاربر معتبر نیست." }, 401);

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role,is_active,approval_status")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: "بررسی مجوز کاربر انجام نشد." }, 503);
  if (!profile || !profile.is_active || profile.approval_status !== "approved" ||
      !["admin", "manager", "expert"].includes(profile.role)) {
    return json({ error: "این حساب مجاز به استفاده از دستیار نگارش نیست." }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "درخواست نامعتبر است." }, 400); }
  const kinds = new Set(["letter", "reply", "minutes", "agenda", "report", "summary", "actions"]);
  const kind = typeof body.kind === "string" ? body.kind : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  if (!kinds.has(kind) || !notes || notes.length > 16000 || context.length > 3000) {
    return json({ error: "نوع سند یا متن ورودی معتبر نیست؛ حداکثر متن ۱۶ هزار نویسه است." }, 400);
  }

  const instructions = [
    "شما دستیار تدوین اسناد اداری سازمان تاکسیرانی تالش هستید.",
    "فقط به زبان فارسی، با لحن رسمی، دقیق و محترمانه بنویس.",
    "هیچ نام، شماره، تاریخ، ماده قانونی، آمار، مصوبه یا تعهدی را جعل نکن.",
    "اطلاعات ناقص را با [نیازمند تکمیل] مشخص کن. اگر درخواست استنباط حقوقی قطعی دارد، محدودیت را روشن کن و متن را برای بازبینی انسانی علامت بزن.",
    "خروجی پیش‌نویس است و نباید وانمود کند تصویب یا امضا شده است.",
    "نوع سند: " + kind,
    "اطلاعات تکمیلی: " + (context || "ارائه نشده"),
  ].join("\n");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-6.2-astra",
        instructions,
        input: notes,
        max_output_tokens: 3000,
        store: false,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI request failed", response.status, detail.slice(0, 500));
      return json({ error: response.status === 429 ? "سهمیه سرویس هوش مصنوعی موقتاً تمام شده است." : "تولید متن انجام نشد؛ بعداً دوباره تلاش کنید." }, 502);
    }
    const result = await response.json();
    const output = Array.isArray(result.output)
      ? result.output
          .filter((item: { type?: string }) => item?.type === "message")
          .flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? [])
          .filter((part: { type?: string; text?: string }) => part?.type === "output_text" && typeof part.text === "string")
          .map((part: { text: string }) => part.text)
          .join("\n")
          .trim()
      : "";
    if (!output) return json({ error: "پاسخ متنی معتبری دریافت نشد." }, 502);
    return json({ draft: output });
  } catch (error) {
    console.error("Writing assistant error", error);
    return json({ error: "ارتباط با سرویس نگارش هوشمند برقرار نشد." }, 502);
  }
});
