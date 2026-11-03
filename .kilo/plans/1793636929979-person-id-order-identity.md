# Plan: Mở rộng số món trong "Món gợi ý theo thời tiết"

## Mục tiêu

Block gợi ý hiện quá ít món (tối đa 4). Mới: **AI chọn 6 món, bổ sung thêm món khớp luật thời
tiết cho đủ tối đa 10 chip**, không trùng, AI luôn đứng trước. Không thêm nhãn phân biệt.

## Nguyên nhân hiện tại (đã kiểm chứng)

| Nơi | Vấn đề |
| --- | --- |
| `js/weather.js:272` `pickWeatherDishes(..., limit = 4)` | Luật cứng trả tối đa 4 → luôn là trần khi không có AI |
| `js/app.js:671-681` `renderWeatherPicks()` | Khi AI có picks → **thay thế** hoàn toàn danh sách luật, nên mất các món luật đã chọn |
| `supabase/functions/weather-suggest/index.ts:358` + `slice(0, 4)` | Prompt yêu cầu "2–4 tên món", server cắt còn 4 |
| `js/app.js:674-678` | So khớp tên AI trả bằng `===` tuyệt đối → lệch khoảng trắng/hoa-thường là bị loại |

## Thay đổi

### 1. `supabase/functions/weather-suggest/index.ts`

- Prompt (mode `suggest`): đổi `"với 2–4 tên món"` → `"với 4–6 tên món"`.
- Cắt kết quả: `.slice(0, 4)` → `.slice(0, 6)` (2 chỗ trong nhánh `suggest`: `advice` và `picks`).
- Không đổi gì ở mode `chat` (vẫn 0–4 picks).

### 2. `js/app.js` — `renderWeatherPicks()`

Thay khối "AI thay thế luật" bằng "AI trước, luật bổ sung":

```js
const AI_LIMIT = 6;
const PICKS_TOTAL = 10;

function matchDishByName(name, pool, menu) {
  const target = normalizeDishKey(name);
  return (
    pool.find((d) => normalizeDishKey(d.name) === target) ||
    menu.find((d) => normalizeDishKey(d.name) === target) ||
    null
  );
}

function normalizeDishKey(s) {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}
```

Luồng:

1. `const res = computeWeatherPicks()` → `res.items` (đổi limit gọi thành `PICKS_TOTAL`, xem mục 3).
2. Nếu có AI: duyệt `ai.picks` (tối đa `AI_LIMIT`), map sang món bằng `matchDishByName` với
   `pool = state.allDishes` và `menu = state.dishes`; bỏ trùng theo `dish.id`.
3. Nối thêm các món từ `res.items` **chưa có trong danh sách trên**, cho tới `PICKS_TOTAL`.
4. Nếu không có AI: dùng trực tiếp `res.items` (đã bị cắt `PICKS_TOTAL`).
5. `items` cuối cùng render như hiện tại (chip + nút `+`, món ngoài menu đang mở có tên quán).

Giữ nguyên `refreshMineUI()` sau khi render để nút `+` đúng trạng thái ✓/disabled.

### 3. `js/weather.js` — `pickWeatherDishes()`

- Đổi tham số mặc định `limit = 4` → `limit = 10`.
- Không đổi logic xếp hạng/từ khoá. (`app.js` sẽ truyền rõ `PICKS_TOTAL`.)

### 4. `js/app.js` — truyền limit

`computeWeatherPicks()` hiện gọi `pickWeatherDishes(pool, state.weather, state.reviewStats, 4)`;
đổi `4` → `10` (hằng `PICKS_TOTAL`).

### 5. CSS (không bắt buộc nhưng nên kiểm tra)

`.weather-picks-list` là `flex-wrap` nên 10 chip sẽ xuống nhiều dòng. Thêm giới hạn chiều cao để
không đẩy danh sách món xuống quá xa:

```css
.weather-picks-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 132px;      /* ~4 dòng chip */
  overflow-y: auto;
  scrollbar-width: thin;
}
```

### 6. Docs

`docs/su-dung.md` mục "Thời tiết & món gợi ý": ghi "tối đa 10 món — AI chọn trước, các món hợp
thời tiết khác bổ sung sau".

## Rủi ro & lưu ý

| Rủi ro | Xử lý |
| --- | --- |
| AI trả nhiều món làm block dài | Trần cứng 10 chip + `max-height` cuộn |
| Tên AI trả lệch khoảng trắng/hoa-thường | `normalizeDishKey()` (trim, gộp space, lowercase) thay `===` |
| Menu ít món (< 10) | Tự nhiên ít hơn; `res.items` không nhân bản, đã bỏ trùng |
| AI lỗi/hết lượt | Vẫn có tới 10 món theo luật (trước đây chỉ 4) |
| `MAX_BODY_BYTES` 8KB | Không đụng: body gửi lên không đổi kích thước |

## Validation

- [ ] `node --check js/app.js js/weather.js` pass.
- [ ] `weather-test.mjs`: cập nhật kỳ vọng `limit` mặc định; thêm test menu 12 món → trả 10.
- [ ] `ai-cache-test.mjs` vẫn pass.
- [ ] Thủ công: bật AI, menu 2 quán ≥ 10 món khớp → block hiện 10 chip, AI trước; không trùng món.
- [ ] Thủ công: AI trả tên lệch khoảng trắng (vd " Canh  chua") vẫn map đúng món.
- [ ] Thủ công: tắt AI (xoá secret tạm) → block hiện 10 món theo luật.
- [ ] Bấm `+` trên chip thứ 8–10 vẫn đặt được, sau khi đặt thành ✓, các chip khác disable.

## Ngoài phạm vi

- Phân nhóm chip theo quán trong block gợi ý.
- Nút "xem thêm" / tải thêm món.
- Cache theo số món.
