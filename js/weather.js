import { WEATHER_LAT, WEATHER_LON, WEATHER_CITY, WEATHER_TZ } from "./config.js";

const CACHE_KEY = "dedatcom_weather_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const NEXT_HOURS = 4;
const EVENING_FROM = 17;
const EVENING_TO = 20;

const HOT_TEMP = 33;
const COOL_TEMP = 24;
const HUMID_PCT = 80;
const RAIN_PCT = 60;

const HOT_KEYWORDS = [
  "tron",
  "goi",
  "nom",
  "salad",
  "lanh",
  "da",
  "cuon",
  "che",
  "sinh to",
];
const COOL_KEYWORDS = [
  "canh",
  "sup",
  "lau",
  "kho",
  "nuong",
  "hap",
  "nong",
  "ca ri",
  "mi",
  "bun",
  "pho",
  "hu tieu",
  "mien",
  "chao",
  "banh canh",
  "ramen",
  "udon",
];

const WMO = [
  { codes: [0, 1], label: "Nắng", icon: "☀️" },
  { codes: [2, 3], label: "Có mây", icon: "⛅" },
  { codes: [45, 48], label: "Sương mù", icon: "🌫️" },
  { codes: [51, 53, 55, 56, 57], label: "Mưa phùn", icon: "🌦️" },
  { codes: [61, 63, 65, 66, 67], label: "Mưa", icon: "🌧️" },
  { codes: [80, 81, 82], label: "Mưa rào", icon: "🌧️" },
  { codes: [95, 96, 99], label: "Dông", icon: "⛈️" },
];

export function describeCode(code) {
  const c = Number(code);
  for (const row of WMO) if (row.codes.includes(c)) return { label: row.label, icon: row.icon };
  return { label: "Không rõ", icon: "🌤️" };
}

/** Bỏ dấu tiếng Việt, lowercase — để so từ khoá trong tên món. */
export function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!raw || typeof raw !== "object" || !raw.data) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* storage bị chặn: bỏ qua cache */
  }
}

function isoHour(date) {
  return String(date.getHours()).padStart(2, "0") + ":00";
}


/**
 * Tính các mốc từ payload Open-Meteo (timezone Asia/Ho_Chi_Minh).
 * Tách riêng để test được bằng Node không cần mạng.
 */
export function buildWeather(payload, now = new Date()) {
  const cur = payload && payload.current;
  const hourly = payload && payload.hourly;
  if (!cur || !hourly || !Array.isArray(hourly.time)) throw new Error("Dữ liệu thời tiết không hợp lệ.");

  const times = hourly.time;

  const nowHour = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:00`;

  const nextHours = [];
  for (let i = 0; i < times.length && nextHours.length < NEXT_HOURS; i++) {
    if (times[i] > nowHour) {
      nextHours.push({
        time: times[i].slice(11, 16),
        temp: Math.round(hourly.temperature_2m[i]),
        humidity: Math.round(hourly.relative_humidity_2m[i]),
        rain: Math.round(hourly.precipitation_probability?.[i] ?? 0),
      });
    }
  }

  const todayStr = nowHour.slice(0, 10);
  const tomorrowStr = (() => {
    const t = new Date(now.getTime() + 86400000);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
      t.getDate()
    ).padStart(2, "0")}`;
  })();

  const collectEvening = (dayStr) => {
    const out = [];
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      if (t.slice(0, 10) !== dayStr) continue;
      const h = Number(t.slice(11, 13));
      if (h >= EVENING_FROM && h <= EVENING_TO) out.push(i);
    }
    return out;
  };

  // Còn giờ 17–20h hôm nay thì dùng hôm nay; quá 20h thì dự báo chiều mai.
  let useTomorrow = false;
  let idx = collectEvening(todayStr);
  if (!idx.length || now.getHours() > EVENING_TO) {
    const tmIdx = collectEvening(tomorrowStr);
    if (tmIdx.length) {
      useTomorrow = true;
      idx = tmIdx;
    }
  }

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const evening = {
    fromHour: EVENING_FROM,
    toHour: EVENING_TO,
    tomorrow: useTomorrow,
    avgTemp: avg(idx.map((i) => hourly.temperature_2m[i]).filter((v) => v != null)),
    avgHumidity: avg(idx.map((i) => hourly.relative_humidity_2m[i]).filter((v) => v != null)),
    maxRain: idx.length
      ? Math.max(...idx.map((i) => hourly.precipitation_probability?.[i] ?? 0))
      : null,
    label: idx.length ? describeCode(hourly.weather_code?.[idx[0]]).label : "",
    icon: idx.length ? describeCode(hourly.weather_code?.[idx[0]]).icon : "🌤️",
  };

  const nowCode = describeCode(cur.weather_code);
  return {
    city: payload.city || WEATHER_CITY,
    current: {
      temp: Math.round(cur.temperature_2m),
      humidity: Math.round(cur.relative_humidity_2m),
      code: cur.weather_code,
      label: nowCode.label,
      icon: nowCode.icon,
      raining: (cur.precipitation ?? 0) > 0 || Number(cur.weather_code) >= 51,
    },
    nextHours,
    evening,
    fetchedAt: Date.now(),
  };
}

export async function fetchWeather({ force = false } = {}) {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.data;

  const params = new URLSearchParams({
    latitude: String(WEATHER_LAT),
    longitude: String(WEATHER_LON),
    current: "temperature_2m,relative_humidity_2m,weather_code,precipitation",
    hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code",
    forecast_days: "2",
    timezone: WEATHER_TZ,
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Open-Meteo trả ${res.status}`);
    const payload = await res.json();
    const data = buildWeather(payload, new Date());
    writeCache(data);
    return data;
  } catch (err) {
    if (cached) return { ...cached.data, stale: true };
    throw err;
  }
}

export function classifyWeather(weather) {
  if (!weather) return "mild";
  const e = weather.evening || {};
  const c = weather.current || {};
  const temp = e.avgTemp != null ? e.avgTemp : c.temp;
  const humidity = e.avgHumidity != null ? e.avgHumidity : c.humidity;

  if ((e.maxRain != null && e.maxRain >= RAIN_PCT) || c.raining === true) return "rainy";
  if (temp != null && temp >= HOT_TEMP) return "hot";
  if (temp != null && temp <= COOL_TEMP) return "cool";
  if (humidity != null && humidity >= HUMID_PCT) return "humid";
  return "mild";
}

export function weatherClassLabel(cls) {
  return (
    {
      hot: "Nóng bức",
      humid: "Nóng ẩm",
      rainy: "Mưa",
      cool: "Mát lạnh",
      mild: "Dễ chịu",
    }[cls] || "Dễ chịu"
  );
}

export function adviceTemplate(cls, weather) {
  const rain = weather?.evening?.maxRain;
  const temp = weather?.evening?.avgTemp;
  const when = weather?.evening?.tomorrow ? "Chiều mai" : "Chiều nay";
  switch (cls) {
    case "rainy":
      return `${when} mưa tới ${rain ?? "?"}%${
        temp != null ? `, ~${temp}°C` : ""
      } — món nước như mì, bún, phở, canh, lẩu cho ấm bụng.`;
    case "hot":
      return `Trời nóng${temp != null ? ` (~${temp}°C)` : ""} — ưu tiên món trộn, gỏi, cuốn cho mát.`;
    case "humid":
      return "Nóng ẩm dễ ngán — món trộn, gỏi, đồ chua nhẹ sẽ dễ ăn hơn món nhiều dầu mỡ.";
    case "cool":
      return `Trời mát${temp != null ? ` (~${temp}°C)` : ""} — món nước, canh, nướng là lựa chọn hợp lý.`;
    default:
      return "Thời tiết dễ chịu — ăn gì cũng được, tham khảo các món được đánh giá cao bên dưới.";
  }
}

function ratingOf(stats, dishId) {
  const s = stats && stats.get(dishId);
  return s && s.count ? s.avg : 0;
}

/**
 * Từ khoá ngắn (≤3 ký tự) phải khớp nguyên một từ, tránh "mi" khớp "cơm".
 */
export function matchesKeyword(hay, key) {
  if (key.length <= 3) {
    return hay.split(/\s+/).some((w) => w === key || w.startsWith(key + "-"));
  }
  return hay.includes(key);
}

export function pickWeatherDishes(dishes, weather, stats, limit = 10) {
  const cls = classifyWeather(weather);
  const list = Array.isArray(dishes) ? dishes : [];
  if (!list.length) return { items: [], cls, relaxed: false };

  const rainyEvening = (weather?.evening?.maxRain ?? 0) >= 40;
  let keys = [];
  if (cls === "hot" || cls === "humid") {
    // Vừa nóng vừa có mưa chiều: cả món mát lẫn món nước đều hợp lý.
    keys = rainyEvening ? [...HOT_KEYWORDS, ...COOL_KEYWORDS] : HOT_KEYWORDS;
  } else if (cls === "rainy" || cls === "cool") {
    keys = COOL_KEYWORDS;
  }

  const scored = list.map((d) => {
    const hay = normalize(d.name);
    const hits = keys.filter((k) => matchesKeyword(hay, k));
    return { dish: d, hits, score: hits.length * 3 + ratingOf(stats, d.id) };
  });

  let matched = scored.filter((s) => s.hits.length);
  let relaxed = false;
  if (!matched.length) {
    relaxed = true;
    matched = scored;
  }

  matched.sort((a, b) => b.score - a.score || ratingOf(stats, a.dish.id) - ratingOf(stats, b.dish.id));
  const items = matched.slice(0, limit).map((s) => ({ dish: s.dish, matched: s.hits.length > 0 }));
  return { items, cls, relaxed };
}
