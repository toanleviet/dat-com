import { getSupabase } from "./supabase-client.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const FN_NAME = "weather-suggest";
const CACHE_KEY = "dedatcom_ai_suggest_v1";
const CACHE_TTL_MS = 60 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const MAX_DISHES = 40;
const MAX_NAME = 80;
const MAX_QUESTION = 300;
const MAX_HISTORY = 6;

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function readCacheEntry() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!raw || typeof raw !== "object" || !raw.data || typeof raw.savedAt !== "number") return null;
    return raw;
  } catch {
    return null;
  }
}

function readCache(key) {
  const raw = readCacheEntry();
  if (!raw || raw.key !== key) return null;
  if (Date.now() - raw.savedAt > CACHE_TTL_MS) return null;
  return raw.data;
}

/** Lời khuyên đã quá 60 phút nhưng < 24h — dùng tạm khi gọi AI lỗi. */
function readStaleCache(key) {
  const raw = readCacheEntry();
  if (!raw || raw.key !== key) return null;
  if (Date.now() - raw.savedAt > STALE_MAX_MS) {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* bỏ qua */
    }
    return null;
  }
  return { ...raw.data, stale: true };
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ key, savedAt: Date.now(), data }));
  } catch {
    /* storage bị chặn: bỏ qua cache */
  }
}

/** Lỗi ngắn, dễ hiểu cho UI (thay vì im lặng). */
export function describeError(err) {
  const status = err?.status ?? err?.context?.status;
  const detail = String(err?.detail || "").slice(0, 120);
  if (status === 404) {
    return "AI chưa được deploy (function weather-suggest không tồn tại).";
  }
  if (status === 401 || status === 403) {
    return "AI từ chối key — kiểm tra secret OPENROUTER_API_KEY trên Supabase.";
  }
  if (status === 429) return "AI đang quá tải, thử lại sau ít phút.";
  if (status === 503) return "Server AI chưa cấu hình key.";
  if (status >= 500) return detail ? `AI lỗi: ${detail}` : "AI đang lỗi tạm thời, thử lại sau.";

  const msg = String(err?.message || err || "").trim();
  if (/Failed to send a request|Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return "Không gọi được AI: trình duyệt chặn/không tới được Edge Function (kiểm tra Network tab, CORS, hoặc function chưa deploy).";
  }
  return msg ? `Không gọi được AI: ${msg.slice(0, 100)}` : "Không gọi được AI.";
}

/** Chuyển danh sách món sang shape gửi server: [{ name, restaurant }]. */
export function toAiDishes(dishes) {
  const out = [];
  for (const d of Array.isArray(dishes) ? dishes : []) {
    const name = String(d?.name ?? (typeof d === "string" ? d : "")).trim().slice(0, MAX_NAME);
    if (!name) continue;
    const restaurant = String(d?.restaurant || "").slice(0, 40);
    out.push({ name, restaurant });
    if (out.length >= MAX_DISHES) break;
  }
  return out;
}

function weatherPayload(weatherClass, weather) {
  return {
    temp: weather?.evening?.avgTemp ?? weather?.current?.temp ?? null,
    humidity: weather?.evening?.avgHumidity ?? weather?.current?.humidity ?? null,
    rain: weather?.evening?.maxRain ?? null,
    label: weather?.evening?.label || weather?.current?.label || "",
    city: weather?.city || "",
    class: weatherClass,
  };
}

/**
 * Gọi Edge Function.
 * Ưu tiên fetch thẳng để giữ **status thật** — `functions.invoke` của supabase-js
 * nuốt lỗi CORS/network thành "Failed to send a request to the Edge Function".
 */
async function invokeFunction(body) {
  const url = `${SUPABASE_URL.trim().replace(/\/+$/, "")}/functions/v1/${FN_NAME}`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY.trim()}`,
        apikey: SUPABASE_ANON_KEY.trim(),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network/CORS: thử lại bằng client supabase (có thể xử lý khác) trước khi báo lỗi
    try {
      const sb = await getSupabase();
      if (sb && sb.functions) {
        const { data, error } = await sb.functions.invoke(FN_NAME, { body });
        if (error) throw error;
        return data;
      }
    } catch {
      /* rơi xuống báo lỗi gốc */
    }
    throw err;
  }

  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(
      (data && (data.error || data.detail)) || `HTTP ${res.status}`
    );
    err.status = res.status;
    err.detail = data && data.detail;
    err.hint = data && data.hint;
    throw err;
  }

  return data;
}

/**
 * Gợi ý món bằng AI qua Supabase Edge Function (key LLM nằm ở server).
 * Trả { advice, picks, stale } hoặc { error } (không còn null im lặng).
 */
export async function getAiSuggestion({ weatherClass, weather, dishes }) {
  const names = toAiDishes(dishes);
  if (!names.length) return { error: "Chưa có món nào trong menu." };

  const day = new Date().toDateString();
  const key = `${day}|${weatherClass}|${hash(names.map((d) => d.name + "|" + d.restaurant).join("|"))}`;
  const cached = readCache(key);
  if (cached) return { ...cached, stale: false };

  const sb = await getSupabase();
  if (!sb) return readStaleCache(key) || { error: "Chưa cấu hình Supabase." };

  const body = {
    mode: "suggest",
    weather: weatherPayload(weatherClass, weather),
    dishes: names,
  };

  try {
    const data = await invokeFunction(body);
    if (!data || typeof data.advice !== "string") {
      return readStaleCache(key) || { error: "AI trả dữ liệu không hợp lệ." };
    }
    const picks = Array.isArray(data.picks) ? data.picks.filter((x) => typeof x === "string") : [];
    if (!data.advice && !picks.length) {
      return readStaleCache(key) || { error: "AI chưa đưa ra gợi ý." };
    }
    const result = { advice: String(data.advice).slice(0, 300), picks };
    writeCache(key, result);
    return { ...result, stale: false };
  } catch (err) {
    return readStaleCache(key) || { error: describeError(err) };
  }
}

/**
 * Hỏi AI tự do. Không cache (câu hỏi khác nhau).
 * Trả { reply, picks } hoặc { error }.
 */
export async function askAiChat({ question, history, weatherClass, weather, dishes }) {
  const q = String(question || "").trim().slice(0, MAX_QUESTION);
  if (!q) return { error: "Hãy nhập câu hỏi." };

  const names = toAiDishes(dishes);
  if (!names.length) return { error: "Đang tải menu — thử lại sau vài giây." };

  const sb = await getSupabase();
  if (!sb) return { error: "Chưa cấu hình Supabase." };

  const hist = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.text === "string" && (m.role === "user" || m.role === "assistant"))
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_QUESTION) }));

  const body = {
    mode: "chat",
    question: q,
    history: hist,
    weather: weatherPayload(weatherClass, weather),
    dishes: names,
  };

  try {
    const data = await invokeFunction(body);
    if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
      return { error: "AI không trả lời được câu này." };
    }
    const picks = Array.isArray(data.picks) ? data.picks.filter((x) => typeof x === "string") : [];
    return { reply: String(data.reply).slice(0, 600), picks };
  } catch (err) {
    return { error: describeError(err) };
  }
}
