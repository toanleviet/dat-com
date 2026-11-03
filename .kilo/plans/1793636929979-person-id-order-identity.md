# Plan: Bỏ AI, gợi ý món thuần theo rule thời tiết

## Mục tiêu

1. **Xoá toàn bộ AI**: khung Hỏi AI, Edge Function, module `ai-suggest.js`, secrets, docs AI.
2. **Giữ và làm rõ gợi ý theo rule**: dựa vào thời tiết TP.HCM, chọn món khớp từ khoá từ **cả 2 menu** → hiện **tối đa 10 chip**, **không lấp thêm** nếu không đủ.
3. Giữ câu mô tả mẫu theo loại thời tiết (không còn AI viết câu).

## Quyết định (user đã chốt)

| Chủ đề | Quyết định |
| --- | --- |
| Nguồn món | Cả **Hải Nam + Dejavu**; chip món quán khác ghi kèm tên quán |
| Số món | Tối đa **10**; **không bổ sung** món ngoài từ khoá khi thiếu (hiện ít hơn) |
| Câu mô tả | Giữ `adviceTemplate()` theo loại thời tiết |
| Code AI | **Xoá hết** (file, function, UI, CSS, state, docs) |

## Hiện trạng liên quan

- `js/weather.js:272` `pickWeatherDishes(dishes, weather, stats, limit = 10)` — đã có luật + từ khoá;
  hiện có nhánh **`relaxed`** trả món bất kỳ khi không khớp → **phải bỏ** (trái quyết định "không lấp").
- `js/app.js`:
  - `renderWeatherPicks()` (~:680-743) ghép picks AI + luật → bỏ nhánh AI.
  - `computeWeatherPicks()`, `matchDishByName()`, `normalizeDishKey()` — chỉ dùng cho AI → xoá.
  - Khối `/* Chat AI */` (~:795-940): `readAiChat/saveAiChat/renderAiChat/setAiChatBusy/pushAiChat/buildAiChatSummary/sendAiChat` + binding form/clear → xoá.
  - `dishPoolForAi()`, `aiShouldRetry()`, `activeRestaurantName()` (chỉ dùng cho AI) → xoá.
  - `loadWeather()` có `getAiSuggestion` → bỏ; chỉ `fetchWeather` + `renderWeatherPanel` + `renderWeatherPicks`.
  - State: `aiSuggestion`, `aiError`, `aiLastTriedAt`, `aiChat`, `aiChatBusy` → xoá; hằng `AI_*`, `KEY_AI_CHAT`, `PICKS_TOTAL`, `AI_PICK_LIMIT` → xoá/giữ theo mục 3.
  - `init()`: `state.aiChat = readAiChat(); renderAiChat()` → xoá.
  - `el`: `aiChat*` → xoá.
- `index.html`: card `🤖 Hỏi AI` (~:70-86) → xoá.
- `css/style.css`: khối `/* Chat AI (dưới card thời tiết) */` (`.ai-chat-*`) → xoá; `.weather-picks-list` `max-height` giữ.
- `js/ai-suggest.js` (254 dòng) + `supabase/functions/weather-suggest/` (index.ts + README) → xoá.
- `supabase/config.toml`: `[functions.weather-suggest]` → xoá mục hàm, giữ `project_id`.
- Docs: `cai-dat.md` mục 5, `xu-ly-su-co.md` các dòng AI, `su-dung.md` mục Hỏi AI, `trien-khai.md` cây file.

## Task

### 1. Rule gợi ý — `js/weather.js`

a) `pickWeatherDishes()`: bỏ `relaxed`:

```js
const matched = scored.filter((s) => s.hits.length);
matched.sort((a, b) => b.score - a.score || ratingOf(stats, a.dish.id) - ratingOf(stats, b.dish.id));
return { items: matched.slice(0, limit).map(...), cls };
```

(Bỏ `relaxed` khỏi return type; cập nhật chỗ dùng.)

b) Bảng từ khoá — mở rộng theo kiểu món Việt, vẫn accent-free (`normalize`):

| Nhóm | Từ khoá |
| --- | --- |
| Mưa / mát (`COOL`) | canh, sup, lau, kho, nuong, hap, nong, ca ri, mi, bun, pho, hu tieu, mien, chao, banh canh, ramen, udon, xao, rim, tiem |
| Nóng / nóng ẩm (`HOT`) | tron, goi, nom, salad, lanh, da, cuon, che, sinh to, do chua, sua chua |

Chỉ thêm từ khoá **chắc chắn là tên món** (kiểm tra không khớp "cơm" — xem `matchesKeyword` với từ ≤3 ký tự).

c) `classifyWeather()` giữ nguyên (rainy → hot → cool → humid → mild).

d) `adviceTemplate()`: bỏ nhắc "AI", giữ nội dung; thêm trường hợp `humid` khi có mưa nhẹ
(`maxRain 40–59`) → "Nóng ẩm, có thể mưa chiều — chọn món vừa mát vừa ấm bụng." (tuỳ chọn, 2 dòng).

### 2. `js/app.js` — render thuần rule

`renderWeatherPicks()` rút gọn:

```js
function renderWeatherPicks() {
  if (!el.weatherPicks) return;
  if (!state.weather) { el.weatherPicks.classList.add("hidden"); return; }

  const res = computeWeatherPicks();          // luật trên pool 2 quán
  if (!res.items.length) { el.weatherPicks.classList.add("hidden"); return; }

  el.weatherPicks.classList.remove("hidden");
  el.weatherAdvice.textContent = adviceTemplate(res.cls, state.weather);
  /* render chip + nút + như hiện tại */
}
```

`computeWeatherPicks()`: `pickWeatherDishes(pool, state.weather, state.reviewStats, 10)`, pool = `state.allDishes || state.dishes`.

`loadWeather()`: bỏ hoàn toàn nhánh `getAiSuggestion`/`aiShouldRetry`; giữ `ensureSpinPool()`, `renderWeatherPanel()`, `renderWeatherPicks()`.

### 3. Xoá code AI

Xoá theo danh sách "Hiện trạng liên quan" ở trên. Cụ thể:

1. Xoá file `js/ai-suggest.js`; xoá thư mục `supabase/functions/weather-suggest/`.
2. `js/app.js`: import `getAiSuggestion, askAiChat`; state `ai*`; el `aiChat*`; hằng
   `AI_RETRY_COOLDOWN_MS`, `AI_RETRY_AFTER_ERROR_MS`, `AI_CHAT_MAX`, `AI_CHAT_KEEP`,
   `AI_HISTORY_SEND`, `AI_CHAT_TTL_MS`, `AI_PICK_LIMIT`, `KEY_AI_CHAT`; hàm
   `dishPoolForAi`, `aiShouldRetry`, `activeRestaurantName`, `matchDishByName`,
   `normalizeDishKey`, toàn bộ khối Chat AI; gọi trong `init()`/`loadWeather()`/`renderWeatherPicks()`.
   Giữ `PICKS_TOTAL = 10`.
3. `index.html`: xoá `<div class="card ai-chat-card">…</div>`.
4. `css/style.css`: xoá khối `.ai-chat-*` + `.ai-chat-list .chat-*` overrides; giữ `.weather-picks*`.
5. `supabase/config.toml`: xoá `[functions.weather-suggest]` (giữ `project_id`).

### 4. Dọn localStorage cũ (một lần, trong `init()`)

```js
try {
  localStorage.removeItem("dedatcom_ai_suggest_v1");
  localStorage.removeItem("dedatcom_ai_chat");
} catch { /* bỏ qua */ }
```

(không bắt buộc nhưng tránh dữ liệu rác)

### 5. Docs

| File | Việc |
| --- | --- |
| `docs/su-dung.md` | Xoá mục "Hỏi AI"; sửa mục thời tiết: "gợi ý theo luật, tối đa 10 món khớp từ khoá, không bổ sung món ngoài" |
| `docs/cai-dat.md` | Xoá mục 5 "Gợi ý món bằng AI"; ghi chú ngắn: chỉ cần Open-Meteo (miễn phí, không key) |
| `docs/xu-ly-su-co.md` | Xoá 7 dòng về AI/function; giữ dòng "Panel thời tiết trống" |
| `docs/trien-khai.md` | Xoá 2 dòng `js/ai-suggest.js`, `supabase/functions/weather-suggest/` khỏi cây file |
| `README.md` | Sửa bullet tính năng: bỏ "lời khuyên AI", còn "gợi ý món theo thời tiết (luật)" |

### 6. Hạ tầng (user chạy, ngoài repo)

```powershell
supabase functions delete weather-suggest --remote wqnhforhekyyyfgbbfsd
supabase secrets unset GEMINI_API_KEY OPENROUTER_API_KEY OPENAI_API_KEY LLM_API_KEY GEMINI_MODELS OPENROUTER_MODELS --remote wqnhforhekyyyfgbbfsd
```

(`secrets unset` có thể cần mỗi lần 1 tên tuỳ phiên bản CLI.)

## Rủi ro & lưu ý

| Rủi ro | Xử lý |
| --- | --- |
| Menu có ít món khớp → hiện 2–3 chip | Đúng quyết định của user; câu advice vẫn giải thích lý do |
| `relaxed` bỏ đi → có hôm block ẩn (không món nào khớp) | Ẩn block trong trường hợp đó; danh sách món bên dưới vẫn đủ |
| Xoá nhầm code dùng chung (`weatherClassLabel`, `adviceTemplate`) | Kiểm tra `grep` trước khi xoá; 2 hàm này **giữ** |
| `state.allDishes` cần cho pool 2 quán | Giữ `ensureSpinPool()` trong `loadWeather` |
| Từ khoá mới khớp nhầm | Test với tên món thật trong menu; từ ≤3 ký tự đi qua `matchesKeyword()` |
| Function đã xoá nhưng client cũ còn cache | Không sao — không còn ai gọi; xoá localStorage ở mục 4 |
| `config.toml` chỉ còn `project_id` | Hợp lệ cho CLI; không deploy function nữa |

## Validation

- [ ] `grep -r "ai-suggest\|aiChat\|aiSuggestion\|weather-suggest" js/ index.html css/` → **rỗng**.
- [ ] `node --check js/app.js js/weather.js js/setup.js` pass; `smoke2.mjs` import app.js không crash.
- [ ] `weather-test.mjs` cập nhật: bỏ kỳ vọng `relaxed`; thêm test "không món nào khớp → `items.length === 0`".
- [ ] `keyword-test.mjs` pass; thêm test từ khoá mới (`Bún bò Huế` khớp `bun`, `Cơm sườn` không khớp `mi`, `Gỏi cuốn` khớp `goi`).
- [ ] Test render: pool 2 quán, trời mưa, 6 món khớp → 6 chip (không lấp 10); cue advice từ `adviceTemplate`.
- [ ] `html-check.mjs`: không ID trùng, `<div>` cân, CSS ngoặc cân; `check-refs.mjs` không báo ID thiếu mới.
- [ ] Thủ công desktop: panel thời tiết cột trái **không còn** card Hỏi AI; block gợi ý có câu + chip, bấm `+` đặt được.
- [ ] Thủ công mobile ≤1200px: cột trái chỉ còn card Thời tiết, không khoảng trống bất thường.
- [ ] Encoding UTF-8 sạch sau khi sửa (không dùng `Get-Content -Raw`/`Set-Content` PowerShell 5.1).
- [ ] `supabase functions list` sau khi delete: không còn `weather-suggest`.

## Ngoài phạm vi

- Admin chỉnh bảng từ khoá trên web (giữ trong code `weather.js`).
- Tag thời tiết trong DB cho từng món.
- Gợi ý theo sở thích cá nhân (lịch sử đặt của user).
- Đổi nguồn thời tiết / nhiều thành phố.
