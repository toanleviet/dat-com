# Plan: Đổi rule mưa sang lượng mưa (mm) — hai ngưỡng 25 / 10 mm

## Vấn đề

App đang dùng `precipitation_probability` (%) với ngưỡng `RAIN_PCT = 60`. Vì % là xác suất **có mưa ở đâu đó trong ô lưới ~11 km** trong giờ đó, TP.HCM mùa mưa gần như **ngày nào cũng ≥ 60%** → ngày nào cũng xếp "mưa" và gợi ý món nước, dù thực tế chỉ mưa nhẹ vài phút.

Đo thực tế 60 ngày qua tại Quận 4 (`10.7575, 106.7053`, Open-Meteo): ngày lớn nhất **41.6 mm**, và tỉ lệ ngày vượt từng ngưỡng là ≥2 mm: 92%, ≥10 mm: 68%, ≥25 mm: 22%, **≥50 mm: 0%**.

## Quyết định (user đã chốt)

Dùng **lượng mưa (mm)** thay cho %, với **hai ngưỡng**:

| Ngưỡng (17–20h) | Phân loại | Ảnh hưởng |
| --- | --- | --- |
| **≥ 25 mm** | `rainy` (mưa to) | Đổi nhóm gợi ý sang món nước |
| **10 – < 25 mm** | mưa nhẹ/trung bình | **Không** đổi nhóm món; chỉ ghi chú "mưa nhẹ ~X mm" trong panel |
| < 10 mm | không mưa | Như bình thường (nóng / nóng ẩm / dịu / mát) |

(Xấp xỉ theo ngày: 25 mm/24h ≈ 5 mm/3h, 10 mm/24h ≈ 2 mm/3h.)

## Đổi gì

### 1. `js/weather.js`

a) Hằng số (thay `RAIN_PCT = 60`):

```js
// Lượng mưa trong khung 17–20h (mm)
const RAIN_HEAVY_MM = 5;    // ≙ ~25 mm/ngày → coi là mưa thật
const RAIN_LIGHT_MM = 2;    // ≙ ~10 mm/ngày → chỉ ghi chú "mưa nhẹ"
```

b) `fetchWeather()` — thêm biến `hourly`:

```
hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code
```

(giữ `precipitation_probability` để hiển thị phụ, không dùng để phân loại nữa)

c) `buildWeather()`:

- `nextHours[]` thêm `mm: Math.round((hourly.precipitation?.[i] ?? 0) * 10) / 10`.
- `evening` thêm:

```js
rainMm: idx.length ? round1(sum(hourly.precipitation[i] for i of idx)) : null,
```

- `current.raining` đổi thành: `(cur.precipitation ?? 0) >= 0.5 && code >= 51` — tránh báo "đang mưa" khi chỉ 0.0–0.4 mm.

d) `classifyWeather()`:

```js
const mm = e.rainMm;
if (mm != null && mm >= RAIN_HEAVY_MM) return "rainy";
// KHÔNG còn dùng % và KHÔNG còn coi current.raining là rainy
if (temp != null && temp >= HOT_TEMP) return "hot";
...
```

e) Thêm helper xuất ra ngoài để UI dùng lại:

```js
export function rainLevel(mm) {
  if (mm == null) return "none";
  if (mm >= RAIN_HEAVY_MM) return "heavy";
  if (mm >= RAIN_LIGHT_MM) return "light";
  return "none";
}
```

f) `adviceTemplate()`:

- `rainy`: dùng `evening.rainMm` thay `maxRain`
  → "Chiều nay mưa ~7 mm (khoảng 30 mm/ngày) — món nước như mì, bún, phở cho ấm bụng."
- `humid`: đổi điều kiện `maxRain >= 40` → `rainLevel(rainMm) === "light"`.
- Trường hợp `light` và lớp khác (hot/cool): thêm câu nhắc ngắn khi hiển thị — xem mục 2.

g) `pickWeatherDishes()`: `rainyEvening` đổi sang `rainLevel(weather?.evening?.rainMm) !== "none"` (nóng + có mưa nhẹ → vẫn ưu tiên union món mát + món nước).

### 2. Panel thời tiết — `js/app.js` `renderWeatherPanel()`

- `#weatherMeta`: thay `🌧️ Mưa 17–20h ${maxRain}%`
  → `🌧️ Mưa 17–20h ~${rainMm} mm` (giữ % làm tooltip: `title="${maxRain}% khả năng có mưa trong khu vực"`).
- `#weatherHours` mỗi chip: thêm `· ${mm}mm` (rỗng nếu 0).
- `#weatherEvening`: dòng tóm tắt thay `mưa X%` bằng `mưa ~X mm` + nhãn cấp:

| `rainLevel` | Nhãn | Màu |
| --- | --- | --- |
| `heavy` | 🔴 mưa to | `--danger` |
| `light` | 🟡 mưa nhẹ | `#b45309` |
| `none` | (không hiện) | — |

- Thêm dòng ghi chú nhỏ dưới panel: *"% chỉ là khả năng có mưa đâu đó trong khu vực TP.HCM — app dùng lượng mưa (mm) để gợi ý món."*

### 3. Docs

- `docs/su-dung.md` mục "Thời tiết & món gợi ý": ghi ngưỡng 25 mm (17–20h ≈ 5 mm) và 10 mm; giải thích vì sao không dùng %.
- `docs/xu-ly-su-co.md`: dòng "Ngày nào cũng gợi ý món nước" → đã sửa: nay dựa trên mm; nếu vẫn lệch, kiểm tra `rainMm` trong payload (`hourly.precipitation`); "Dự báo mưa nhưng không mưa" → % là xác suất theo vùng, không phải điểm.

## Rủi ro & lưu ý

| Rủi ro | Xử lý |
| --- | --- |
| Open-Meteo không trả `hourly.precipitation` (đổi API) | `rainMm` = `null` → không bao giờ `rainy`; app vẫn chạy, chỉ mất nhóm mưa |
| Ngưỡng 5 mm/3h vẫn gợi ý món nước ~22% ngày | Đúng lựa chọn; nếu thấy nhiều, nâng `RAIN_HEAVY_MM` (một hằng số) |
| Mưa rào cục bộ nặng hơn mô hình (ô 11 km làm mượt) | Nêu trong docs; không giải quyết được ở client |
| `evening` là ngày mai sau 20h | Như hiện tại, dùng đúng khung giờ |
| Cache `dedatcom_weather_v1` còn dữ liệu cũ (không có `rainMm`) | `buildWeather` tính lại từ payload mỗi lần fetch; cache cũ hết hạn sau 10 phút. Không cần migration |

## Thứ tự thực hiện

1. `js/weather.js`: hằng số, `fetchWeather` params, `buildWeather` (`mm`, `rainMm`), `classifyWeather`, `rainLevel`, `adviceTemplate`, `pickWeatherDishes`.
2. `js/app.js`: `renderWeatherPanel()` hiển thị mm + nhãn cấp + tooltip %.
3. Docs.
4. Chạy test.

## Validation

- [ ] `node --check js/weather.js js/app.js`.
- [ ] Test thuần (`weather-test.mjs` / `tz-test.mjs` cập nhật payload có `precipitation`):
  - 17–20h tổng 0.4 mm → `classify = hot|humid`, **không** `rainy`.
  - tổng 6 mm → `rainy`.
  - `rainLevel(0)`/`(1.5)`/`(6)` → `none`/`light`/`heavy`.
  - Không có `hourly.precipitation` → `rainMm = null`, không crash, không `rainy`.
- [ ] Thủ công: ngày mưa nhẹ (như 28/10: 0.4 mm) → panel hiện "mưa 17–20h ~0.4 mm", block gợi ý vẫn theo nóng/nóng ẩm.
- [ ] Thủ công: ngày mưa 41.6 mm → `rainy`, gợi ý món nước, nhãn 🔴 mưa to.
- [ ] Smoke + `html-check` (không ID trùng, div/CSS cân bằng).
- [ ] Encoding UTF-8 sạch.

## Ngoài phạm vi

- Dùng nguồn NCHMF (không có API, chỉ văn bản cấp thành phố).
- Dự báo theo quận (mô hình lưới ~11 km, không đủ phân giải).
- Cảnh báo ngập/thiên tai.
- Lưu lịch sử dự báo để đánh giá độ chính xác.
