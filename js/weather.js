import { WEATHER_LAT, WEATHER_LON, WEATHER_CITY, WEATHER_TZ } from "./config.js";

const CACHE_KEY = "dedatcom_weather_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const NEXT_HOURS = 4;
const EVENING_FROM = 17;
const EVENING_TO = 20;

const HOT_TEMP = 33;
const COOL_TEMP = 24;
const HUMID_PCT = 80;

// Lượng mưa (mm) trong khung 17–20h — nguồn sự thật để phân loại "mưa".
// Xấp xỉ theo ngày: 5 mm/3h ≙ ~25 mm/ngày (mưa thật), 2 mm/3h ≙ ~10 mm/ngày (mưa nhẹ).
const RAIN_HEAVY_MM = 5;
const RAIN_LIGHT_MM = 2;

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
  "do chua",
  "sua chua",
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
  "xao",
  "rim",
  "tiem",
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
 * "Bây giờ" theo giờ ĐỊA PHƯƠNG của dữ liệu (Open-Meteo trả giờ đã theo `timezone`),
 * KHÔNG dùng giờ máy — máy ở múi giờ khác sẽ cắt sai khung giờ.
 */
function localNow(payload, fallback = new Date()) {
  const raw = payload?.current?.time;
  const m = typeof raw === "string" ? raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/) : null;
  if (m) {
    const [, y, mo, d, h, mi] = m;
    return {
      isoHour: `${y}-${mo}-${d}T${h}:00`,
      hour: Number(h),
      dayStr: `${y}-${mo}-${d}`,
      minutes: Number(mi),
    };
  }
  const pad = (n) => String(n).padStart(2, "0");
  return {
    isoHour: `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(
      fallback.getDate()
    )}T${pad(fallback.getHours())}:00`,
    hour: fallback.getHours(),
    dayStr: `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}`,
    minutes: fallback.getMinutes(),
  };
}

function nextDay(dayStr) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Tính các mốc từ payload Open-Meteo (timezone Asia/Ho_Chi_Minh).
 * `fallbackNow` chỉ dùng khi payload thiếu `current.time`.
 */
export function buildWeather(payload, fallbackNow = new Date()) {
  const cur = payload && payload.current;
  const hourly = payload && payload.hourly;
  if (!cur || !hourly || !Array.isArray(hourly.time)) throw new Error("Dữ liệu thời tiết không hợp lệ.");

  const times = hourly.time;
  const nowLocal = localNow(payload, fallbackNow);
  const nowHour = nowLocal.isoHour;

  const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
  const precipAt = (i) => round1(hourly.precipitation?.[i] ?? 0);

  const nextHours = [];
  for (let i = 0; i < times.length && nextHours.length < NEXT_HOURS; i++) {
    if (times[i] > nowHour) {
      nextHours.push({
        time: times[i].slice(11, 16),
        temp: Math.round(hourly.temperature_2m[i]),
        humidity: Math.round(hourly.relative_humidity_2m[i]),
        rain: Math.round(hourly.precipitation_probability?.[i] ?? 0),
        mm: precipAt(i),
      });
    }
  }

  const todayStr = nowLocal.dayStr;
  const tomorrowStr = nextDay(todayStr);

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

  // Còn giờ 17–20h hôm nay thì dùng hôm nay; quá 20h (giờ địa phương) thì dự báo chiều mai.
  let useTomorrow = false;
  let idx = collectEvening(todayStr);
  if (!idx.length || nowLocal.hour > EVENING_TO) {
    const tmIdx = collectEvening(tomorrowStr);
    if (tmIdx.length) {
      useTomorrow = true;
      idx = tmIdx;
    }
  }

  // Nhiệt độ "trưa" (11–16h) — phản ánh đúng cái nóng ban ngày, không bị mưa chiều làm nguội.
  const collectMidday = (dayStr) => {
    const out = [];
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      if (t.slice(0, 10) !== dayStr) continue;
      const h = Number(t.slice(11, 13));
      if (h >= 11 && h <= 16 && hourly.temperature_2m[i] != null) out.push(hourly.temperature_2m[i]);
    }
    return out;
  };
  const middayVals = useTomorrow ? collectMidday(tomorrowStr) : collectMidday(todayStr);

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const evening = {
    fromHour: EVENING_FROM,
    toHour: EVENING_TO,
    tomorrow: useTomorrow,
    avgTemp: avg(idx.map((i) => hourly.temperature_2m[i]).filter((v) => v != null)),
    maxTemp: middayVals.length ? Math.round(Math.max(...middayVals)) : null,
    avgHumidity: avg(idx.map((i) => hourly.relative_humidity_2m[i]).filter((v) => v != null)),
    maxRain: idx.length
      ? Math.max(...idx.map((i) => hourly.precipitation_probability?.[i] ?? 0))
      : null,
    // Tổng lượng mưa khung 17–20h (mm) — dùng để phân loại mưa thay cho %.
    rainMm: idx.length ? round1(idx.reduce((sum, i) => sum + precipAt(i), 0)) : null,
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
      raining: (cur.precipitation ?? 0) >= 0.5 && Number(cur.weather_code) >= 51,
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
    hourly: "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code",
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

/** Cấp mưa theo tổng mm khung 17–20h. */
export function rainLevel(mm) {
  if (mm == null) return "none";
  if (mm >= RAIN_HEAVY_MM) return "heavy";
  if (mm >= RAIN_LIGHT_MM) return "light";
  return "none";
}

export function classifyWeather(weather) {
  if (!weather) return "mild";
  const e = weather.evening || {};
  const c = weather.current || {};
  // Cái nóng ban ngày phản ánh bằng nhiệt độ trưa (11–16h), không dùng TB 17–20h
  // vì mưa chiều hạ nhiệt độ xuống rất sâu.
  const temp = e.maxTemp != null ? e.maxTemp : e.avgTemp != null ? e.avgTemp : c.temp;
  const humidity = e.avgHumidity != null ? e.avgHumidity : c.humidity;

  // Chỉ xếp "mưa" khi lượng mưa thật đủ lớn; % khả năng mưa không dùng để phân loại.
  if (rainLevel(e.rainMm) === "heavy") return "rainy";
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
  const mm = weather?.evening?.rainMm;
  const pct = weather?.evening?.maxRain;
  const temp = weather?.evening?.maxTemp ?? weather?.evening?.avgTemp;
  const when = weather?.evening?.tomorrow ? "Chiều mai" : "Chiều nay";
  switch (cls) {
    case "rainy":
      return `${when} mưa ~${mm ?? "?"} mm${
        temp != null ? `, ~${temp}°C` : ""
      } — món nước như mì, bún, phở, canh, lẩu cho ấm bụng.`;
    case "hot":
      return rainLevel(mm) === "light"
        ? `Trời nóng${temp != null ? ` (~${temp}°C)` : ""} — chiều có mưa nhẹ (~${mm} mm), chọn món trộn, gỏi, cuốn cho mát.`
        : `Trời nóng${temp != null ? ` (~${temp}°C)` : ""} — ưu tiên món trộn, gỏi, cuốn cho mát.`;
    case "humid":
      return rainLevel(mm) === "light"
        ? `Nóng ẩm, chiều có mưa nhẹ ~${mm} mm — món trộn, gỏi, hoặc món nước nhẹ bụng đều hợp.`
        : "Nóng ẩm dễ ngán — món trộn, gỏi, đồ chua nhẹ sẽ dễ ăn hơn món nhiều dầu mỡ.";
    case "cool":
      return `Trời mát${temp != null ? ` (~${temp}°C)` : ""} — món nước, canh, nướng là lựa chọn hợp lý.`;
    default:
      return rainLevel(mm) === "light"
        ? `Thời tiết dễ chịu, chiều có mưa nhẹ ~${mm} mm — ăn gì cũng được, tham khảo món được đánh giá cao.`
        : "Thời tiết dễ chịu — ăn gì cũng được, tham khảo các món được đánh giá cao bên dưới.";
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
  if (!list.length) return { items: [], cls };

  const rainyEvening = rainLevel(weather?.evening?.rainMm) !== "none";
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

  // Chỉ trả món khớp từ khoá thời tiết — không lấp thêm món ngoài luật.
  const matched = scored.filter((s) => s.hits.length);
  matched.sort((a, b) => b.score - a.score || ratingOf(stats, a.dish.id) - ratingOf(stats, b.dish.id));
  const items = matched.slice(0, limit).map((s) => ({ dish: s.dish }));
  return { items, cls };
}
