# Edge Function: `weather-suggest`

Gợi ý món theo thời tiết bằng LLM. Key LLM **chỉ nằm ở secrets của Supabase**, không có trong code client.

## Deploy

`supabase/config.toml` đã khai báo `project_id` và `verify_jwt = false` cho function này,
nên chỉ cần:

```powershell
cd D:\DatCom          # bắt buộc: thư mục CHA của supabase/
supabase login
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
supabase secrets set LLM_MODEL=openrouter/free       # tuỳ chọn, đây là mặc định
# danh sách model dự phòng (thử lần lượt khi model trước bận/hết lượt):
# supabase secrets set LLM_MODELS=openrouter/free,google/gemma-3-27b-it:free
supabase functions deploy weather-suggest
```

Nếu chạy ở thư mục khác, truyền rõ workdir:

```powershell
supabase functions deploy weather-suggest --workdir D:\DatCom --remote wqnhforhekyyyfgbbfsd
```

> Nếu log deploy báo `Entrypoint path does not exist .../supabase/functions/weather-suggest/index.ts`
> thì gần như chắc chắn là **sai thư mục làm việc** — CLI đang tìm file tương đối từ cwd.
> `WARNING: Docker is not running` thì không sao, chỉ cần khi `functions serve` local.

## Xem log

CLI bản mới **không còn** `supabase functions logs`. Xem ở Dashboard →
**Edge Functions** → `weather-suggest` → **Logs**. Mọi lỗi 502 đều `console.error` kèm
HTTP status + thân phản hồi của nhà cung cấp AI (cắt 500 ký tự).

## Biến môi trường

| Biến | Bắt buộc | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | Có | — | Key OpenRouter (`sk-or-v1-...`). Được ưu tiên đọc trước |
| `OPENAI_API_KEY` / `LLM_API_KEY` | Không | — | Chỉ để tương thích cấu hình cũ; dùng khi không set `OPENROUTER_API_KEY` |
| `LLM_MODEL` | Không | `openrouter/free` | Model chính |
| `LLM_MODELS` | Không | — | Danh sách phẩy, thử lần lượt: model lỗi `404/429/5xx` thì sang model kế |
| `OPENAI_BASE_URL` | Không | `https://openrouter.ai/api/v1` | Đổi nếu dùng gateway khác (phải có `/v1` hoặc `/v1beta`) |
| `ALLOWED_ORIGIN` | Không | `*` | Nên đặt đúng domain deploy |
| `APP_URL` | Không | GitHub repo | Gửi kèm `HTTP-Referer`/`X-Title` tới OpenRouter |

### Cách function chịu lỗi

- Mỗi model được gọi tối đa **3 lần** khi gặp `429/500/502/503/504` (backoff 400ms, 900ms,
  timeout 8s/lần).
- Hết retry mà vẫn lỗi → chuyển sang model kế trong `LLM_MODELS`.
- Hết danh sách → `502` kèm `{ status, detail, hint, tried }`.
- `openrouter/free` là **router** của OpenRouter: nó tự chọn model free còn lượt, nên tên model
  thật có thể khác nhau mỗi lần. Muốn tất định, đặt model cụ thể trong `LLM_MODELS`.

### Ghi chú free tier OpenRouter

- Hạn mức tính theo **số request/phút và /ngày**, tuỳ model phía sau router. Vượt hạn mức → `429`
  (có retry), hết lượt model → `404`/`402`.
- Trang luôn fallback: ưu tiên lời khuyên đã cache (nhãn "cũ"), không có thì dùng luật cứng.
- Cache 60 phút ở client (`js/ai-suggest.js`) giúp giảm mạnh số lần gọi.
- Gói free có thể dùng dữ liệu để cải thiện sản phẩm. Payload chỉ gồm **tên món + thời tiết**,
  không có tên người dùng.

## Hợp đồng

`POST` body (≤ 8KB), hai chế độ qua `mode`:

```json
{
  "mode": "suggest",
  "weather": { "temp": 31, "humidity": 82, "rain": 70, "label": "Mưa", "city": "TP.HCM", "class": "rainy" },
  "dishes": [{ "name": "Cơm sườn", "restaurant": "Hải Nam" }, { "name": "Cơm bò lắc", "restaurant": "Dejavu" }]
}
```

```json
{
  "mode": "chat",
  "question": "tôi dị ứng hải sản, ăn gì?",
  "history": [{ "role": "user", "text": "..." }, { "role": "assistant", "text": "..." }],
  "weather": { "temp": 31, "humidity": 82, "rain": 70, "label": "Mưa", "city": "TP.HCM", "class": "rainy" },
  "dishes": [{ "name": "Cơm sườn", "restaurant": "Hải Nam" }]
}
```

`dishes` chấp nhận cả dạng cũ `["tên món"]`. Prompt nhóm món theo quán để AI thấy **cả hai menu**.

Trả về:

```json
// mode = suggest
{ "advice": "Chiều nay mưa 70%, ăn bún bò cho ấm.", "picks": ["Bún bò Huế"], "model": "..." }

// mode = chat
{ "reply": "Mưa nên ăn món nước cho ấm, và tránh hải sản.", "picks": ["Bún bò Huế"], "model": "..." }
```

`picks` luôn được lọc lại theo đúng menu gửi lên (chống AI bịa món). `history` tối đa 6 lượt,
`question` ≤ 300 ký tự, `reply` ≤ 400 ký tự.

Lỗi: `400` body sai, `405` sai method, `502` LLM lỗi (kèm `status` + `detail` + `hint` +
`tried` để dễ debug), `503` chưa set key.

## Test nhanh (PowerShell)

```powershell
$body = @{
  weather = @{ temp = 31; humidity = 82; rain = 70; label = "Mua"; city = "TP.HCM"; class = "rainy" }
  dishes  = @("Com suon", "Com ga nuong")
} | ConvertTo-Json -Depth 5
$anon = "<ANON_KEY trong js/config.js>"
Invoke-RestMethod -Method Post `
  -Uri "https://wqnhforhekyyyfgbbfsd.supabase.co/functions/v1/weather-suggest" `
  -Headers @{ Authorization = "Bearer $anon" } -ContentType "application/json" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## Không bật AI thì sao?

Trang vẫn hoạt động: block "Món gợi ý theo thời tiết" dùng luật cứng trong `js/weather.js`
và câu giải thích mẫu trong `adviceTemplate()`.
