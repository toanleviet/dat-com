// Supabase Edge Function: gợi ý món theo thời tiết bằng LLM.
// Mặc định dùng OpenRouter (model free) qua cổng OpenAI-compatible.
// Key LLM chỉ nằm ở secrets của Supabase, KHÔNG bao giờ ở client.
//
// Deploy:  cd D:\DatCom && supabase functions deploy weather-suggest
// Secrets: supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
//          [LLM_MODEL=openrouter/free] [LLM_MODELS=a:free,b:free]
//          [OPENAI_BASE_URL=https://openrouter.ai/api/v1] [ALLOWED_ORIGIN=*] [APP_URL=...]
// Log:     Dashboard → Edge Functions → weather-suggest → Logs

const MAX_BODY_BYTES = 8192;
const MAX_DISHES = 40;
const MAX_DISH_NAME = 80;
const MAX_ADVICE = 200;
const MAX_REPLY = 400;
const MAX_QUESTION = 300;
const MAX_HISTORY = 6;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

function badRequest(msg: string) {
  return json({ error: msg }, 400);
}

type Weather = {
  temp: number | null;
  humidity: number | null;
  rain: number | null;
  label: string;
  city: string;
  class: string;
};

function readWeather(raw: unknown): Weather | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    temp: num(o.temp),
    humidity: num(o.humidity),
    rain: num(o.rain),
    label: str(o.label, 40),
    city: str(o.city, 40),
    class: str(o.class, 20),
  };
}

/** Món kèm tên quán; chấp nhận cả ["tên"] cũ lẫn [{name, restaurant}]. */
function readDishList(raw: unknown): { name: string; restaurant: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; restaurant: string }[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const name = item.trim().slice(0, MAX_DISH_NAME);
      if (name) out.push({ name, restaurant: "" });
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim().slice(0, MAX_DISH_NAME) : "";
      const restaurant =
        typeof o.restaurant === "string" ? o.restaurant.trim().slice(0, 40) : "";
      if (name) out.push({ name, restaurant });
    }
    if (out.length >= MAX_DISHES) break;
  }
  return out;
}

function readHistory(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : "";
    const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_QUESTION) : "";
    if (!role || !text) continue;
    out.push({ role, content: text });
  }
  return out.slice(-MAX_HISTORY);
}

/** Nhóm món theo quán để prompt thấy rõ cả Hải Nam lẫn Dejavu. */
function menuLines(list: { name: string; restaurant: string }[]): string {
  const groups = new Map<string, string[]>();
  for (const d of list) {
    const key = d.restaurant || "Menu khác";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d.name);
  }
  return [...groups.entries()]
    .map(([restaurant, names]) => `- ${restaurant}: ${names.join(", ")}`)
    .join("\n");
}

/** JSON.parse, nhưng chịu được model bọc ```json ... ``` hoặc kèm chữ thừa. */
function parseJsonLoose(text: string): { advice?: unknown; picks?: unknown } | null {
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" ? (v as { advice?: unknown; picks?: unknown }) : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(text.trim());
  if (direct) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const inner = tryParse(fenced[1].trim());
    if (inner) return inner;
  }

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return tryParse(text.slice(first, last + 1));
  }
  return null;
}

type ModelResult =
  | { ok: true; content: string }
  | { ok: false; status: number; detail: string };

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const BACKOFF_MS = [400, 900];
const FETCH_TIMEOUT_MS = 8000;

function extractDetail(text: string): string {
  try {
    const parsed = JSON.parse(text);
    const msg =
      (parsed?.error?.message as string) ||
      (Array.isArray(parsed) ? (parsed[0]?.error?.message as string) : "") ||
      "";
    if (msg) return String(msg);
  } catch {
    /* body không phải JSON */
  }
  return text ? text.slice(0, 200) : "";
}

/** Gọi 1 model, tự retry khi 429/5xx. */
async function callModel(
  model: string,
  system: string,
  user: string,
  apiKey: string,
  baseUrl: string
): Promise<ModelResult> {
  return callModelMessages(
    model,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    apiKey,
    baseUrl,
    300
  );
}

async function callModelMessages(
  model: string,
  messages: { role: string; content: string }[],
  apiKey: string,
  baseUrl: string,
  maxTokens = 300
): Promise<ModelResult> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": Deno.env.get("APP_URL") || "https://github.com/toanleviet/dat-com",
          "X-Title": "Dat com",
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          max_tokens: maxTokens,
          messages,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("LLM fetch failed", model, baseUrl, detail);
      if (attempt < BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
        continue;
      }
      return { ok: false, status: 0, detail: `Không gọi được dịch vụ AI: ${detail}` };
    }

    const text = await res.text().catch(() => "");

    if (res.ok) {
      let completion: { choices?: { message?: { content?: unknown } }[] } | null = null;
      try {
        completion = JSON.parse(text);
      } catch {
        console.error("LLM trả body không phải JSON:", model, text.slice(0, 300));
      }
      const content = completion?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) return { ok: true, content };
      console.error("LLM trả dữ liệu rỗng:", model, text.slice(0, 300));
      if (attempt < BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
        continue;
      }
      return { ok: false, status: res.status, detail: "AI trả dữ liệu rỗng." };
    }

    const detail = extractDetail(text);
    if (RETRYABLE.has(res.status) && attempt < BACKOFF_MS.length) {
      console.warn("LLM retry", model, res.status, "attempt", attempt + 1, detail.slice(0, 120));
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      continue;
    }
    console.error("LLM error", model, res.status, text.slice(0, 500));
    return { ok: false, status: res.status, detail };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "Chỉ hỗ trợ POST" }, 405);

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return badRequest("Body quá lớn.");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text);
  } catch {
    return badRequest("JSON không hợp lệ.");
  }

  const weather = readWeather(payload.weather);
  const mode = payload.mode === "chat" ? "chat" : "suggest";
  const dishList = readDishList(payload.dishes);
  if (!dishList.length) return badRequest("Thiếu danh sách món.");
  const question =
    typeof payload.question === "string" ? payload.question.trim().slice(0, MAX_QUESTION) : "";
  const history = readHistory(payload.history);

  const apiKey =
    Deno.env.get("OPENROUTER_API_KEY") ||
    Deno.env.get("OPENAI_API_KEY") ||
    Deno.env.get("LLM_API_KEY");
  if (!apiKey) return json({ error: "Server chưa cấu hình LLM (thiếu OPENROUTER_API_KEY)." }, 503);

  const baseUrl = (Deno.env.get("OPENAI_BASE_URL") || "https://openrouter.ai/api/v1").replace(
    /\/+$/,
    ""
  );

  const models = (Deno.env.get("LLM_MODELS") || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!models.length) models.push(Deno.env.get("LLM_MODEL") || "openrouter/free");

  if (!baseUrl.includes("/v1") && !baseUrl.includes("/v1beta")) {
    console.warn("OPENAI_BASE_URL thiếu /v1 — gateway OpenAI-compatible thường cần hậu tố này:", baseUrl);
  }

  const weatherLine = weather
    ? `Thời tiết ${weather.city || "TP.HCM"}: ${weather.label || "không rõ"}, ` +
      `nhiệt độ chiều tối ${weather.temp ?? "?"}°C, độ ẩm ${weather.humidity ?? "?"}%, ` +
      `xác suất mưa khung 17–20h ${weather.rain ?? "?"}%, phân loại ${weather.class || "không rõ"}.`
    : "Không có dữ liệu thời tiết.";

  const menu = menuLines(dishList);
  const allowed = new Set(dishList.map((d) => d.name));

  // ---------- Chat tự do ----------
  if (mode === "chat") {
    const systemChat =
      "Bạn là trợ lý chọn món trưa cho nhân viên văn phòng ở TP.HCM. " +
      "Chỉ tư vấn trong menu được cung cấp (cả hai quán), tuyệt đối không bịa tên món mới. " +
      "Trả lời ngắn gọn, thân thiện, tiếng Việt, 2–4 câu (tối đa 400 ký tự). " +
      "Nếu câu hỏi ngoài phạm vi ăn trưa, trả lời gọn rồi kéo về menu. " +
      'Trả về JSON đúng dạng {"reply": "<câu trả lời>", "picks": ["<tên món>", ...]} ' +
      "với 0–4 tên món lấy nguyên văn từ menu. Không thêm chữ nào ngoài JSON.";

    const userChat =
      `${weatherLine}\nMenu đang bán:\n${menu}\n\n` +
      (question ? `Câu hỏi của nhân viên: ${question}` : "Hãy gợi ý món phù hợp thời tiết.");

    const messages: { role: string; content: string }[] = [{ role: "system", content: systemChat }];
    for (const h of history) messages.push(h);
    messages.push({ role: "user", content: userChat });

    let lastChat: { status: number; detail: string; model: string } | null = null;
    for (const model of models) {
      const res = await callModelMessages(model, messages, apiKey, baseUrl, 500);
      if (res.ok) {
        const parsed = parseJsonLoose(res.content);
        if (!parsed) {
          console.error("AI chat JSON lỗi:", model, res.content.slice(0, 300));
          lastChat = { status: 200, detail: "AI trả JSON không hợp lệ.", model };
          continue;
        }
        const reply =
          typeof parsed.reply === "string" ? parsed.reply.trim().slice(0, MAX_REPLY) : "";
        const picks = Array.isArray(parsed.picks)
          ? parsed.picks.filter((p): p is string => typeof p === "string" && allowed.has(p)).slice(0, 4)
          : [];
        if (!reply) {
          lastChat = { status: 200, detail: "AI không trả lời được.", model };
          continue;
        }
        return json({ reply, picks, model });
      }
      lastChat = { status: res.status, detail: res.detail, model };
      console.warn("LLM chat model failed", model, res.status, res.detail.slice(0, 200));
    }

    const st = lastChat?.status ?? 502;
    return json(
      {
        error: "Dịch vụ AI trả lỗi.",
        status: st,
        detail: lastChat?.detail || undefined,
        hint: aiHint(st),
        tried: models,
      },
      502
    );
  }

  // ---------- Gợi ý theo thời tiết ----------
  const system =
    "Bạn là trợ lý chọn món trưa cho nhân viên văn phòng ở TP.HCM. " +
    "Chỉ được chọn trong menu người dùng cung cấp (đọc kỹ cả hai quán), tuyệt đối không bịa tên món mới. " +
    "Khi thời tiết mưa hoặc lạnh, ưu tiên cả món nước: mì, bún, phở, hủ tiếu, miến, cháo, súp, lẩu. " +
    "Khi nóng, ưu tiên món trộn, gỏi, cuốn, món mát. Nêu lý do ngắn gắn với thời tiết. " +
    'Trả về JSON đúng dạng {"advice": "<1-2 câu tiếng Việt, tối đa 160 ký tự>", "picks": ["<tên món>", ...]} ' +
    "với 4–6 tên món lấy nguyên văn từ menu. Không thêm chữ nào ngoài JSON.";

  const user = `${weatherLine}\nMenu đang bán:\n${menu}`;

  // Thử lần lượt từng model; model đầu bận/lỗi tạm thời thì sang model kế.
  let last: { status: number; detail: string; model: string } | null = null;
  for (const model of models) {
    const res = await callModel(model, system, user, apiKey, baseUrl);
    if (res.ok) {
      const parsed = parseJsonLoose(res.content);
      if (!parsed) {
        console.error("AI trả JSON không hợp lệ:", model, res.content.slice(0, 500));
        last = { status: 200, detail: "AI trả JSON không hợp lệ.", model };
        continue;
      }

      const advice =
        typeof parsed.advice === "string" ? parsed.advice.trim().slice(0, MAX_ADVICE) : "";
      const picks = Array.isArray(parsed.picks)
        ? parsed.picks
            .filter((p): p is string => typeof p === "string" && allowed.has(p))
            .slice(0, 6)
        : [];

      if (!advice && !picks.length) {
        console.error("AI không trả gợi ý hợp lệ:", model, res.content.slice(0, 300));
        last = { status: 200, detail: "AI không trả gợi ý hợp lệ.", model };
        continue;
      }
      return json({ advice, picks, model });
    }

    last = { status: res.status, detail: res.detail, model };
    console.warn("LLM model failed", model, res.status, res.detail.slice(0, 200));
  }

  const status = last?.status ?? 502;
  return json(
    {
      error: "Dịch vụ AI trả lỗi.",
      status,
      detail: last?.detail || undefined,
      hint: aiHint(status),
      tried: models,
    },
    502
  );
});

function aiHint(status: number): string | undefined {
  if (status === 429) return "Hết hạn mức free — chờ hoặc đổi LLM_MODELS.";
  if (status === 401 || status === 403) return "Key OpenRouter sai/hết hiệu lực (OPENROUTER_API_KEY).";
  if (status === 404) return "Model không tồn tại/không hỗ trợ — đổi LLM_MODEL(S).";
  if (status === 402) return "OpenRouter báo hết credit cho model này — đổi LLM_MODELS.";
  return undefined;
}

