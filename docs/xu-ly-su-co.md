[← Về README](../README.md)

# Rủi ro & giới hạn, xử lý sự cố

## Rủi ro & giới hạn đã chấp nhận

- **Không có đăng nhập, không có mật khẩu.** Bất kỳ ai có link + anon key đều
  đọc / thêm / xóa đơn, sửa món và đánh giá món. Chỉ chia sẻ trong nội bộ.
  - **Mọi người xóa được đơn của người khác** (theo yêu cầu), có hộp thoại xác nhận.
  - **Mọi người thêm/sửa/ẩn/xóa được món** ở `setup.html` — không có mật khẩu.
  - Mọi người xem và xóa được đánh giá của nhau.
- **"Hôm nay" tính theo giờ trình duyệt** của từng máy. Máy sai giờ hoặc múi giờ
  khác sẽ thấy danh sách khác.
- Không xuất file Word — chỉ **Copy** text.
- Ảnh món do bất kỳ ai upload; nếu ai đó up ảnh quá lớn/xấu, sửa tay ở trang Setup.
- Đánh giá không giới hạn số lần: một người có thể spam nhiều dòng cho cùng một món.
- **Giới hạn 1 món/người/ngày được thực thi ở giao diện**, không phải ở database
  (không có đăng nhập nên Postgres không biết "ai là ai"). Nếu ai đó gọi thẳng API
  Supabase vẫn có thể tạo nhiều đơn; trang web sẽ đổi món (xóa đơn cũ của tên đó,
  tạo đơn mới) khi người đó quyết định thay.
- Nhãn **NEW** do người dùng tự bật/tắt, không tự hết hạn — bật nhiều món cùng lúc
  sẽ rối mắt.

## Xử lý sự cố

| Hiện tượng | Nguyên nhân / cách sửa |
| --- | --- |
| Banner "Chưa cấu hình Supabase" | Điền `SUPABASE_URL` + `SUPABASE_ANON_KEY` trong `js/config.js`, tải lại trang (Ctrl+F5). |
| "Không kết nối được Supabase" | Sai URL/key, hoặc chưa chạy `schema.sql`. Xem Console trình duyệt (F12). |
| Danh sách không tự cập nhật giữa các máy | Chưa bật realtime cho `orders` — chạy lại phần realtime trong `schema.sql`. |
| `column dishes.is_new does not exist` (mã 42703) | Database chưa có cột NEW — chạy khối `MIGRATION: Nhãn NEW cho món mới` trong `schema.sql`, rồi Ctrl+F5. |
| `column orders.person_id does not exist` (mã 42703) | Database chưa có cột định danh người đặt — chạy khối `MIGRATION: Định danh người đặt (person_id)` trong `schema.sql`, rồi Ctrl+F5. |
| Đổi tên xong vẫn thấy món cũ nhưng không đổi được / bị báo "Bạn đã chọn món rồi" | Đúng hành vi: đơn gắn với trình duyệt, đổi tên không tạo đơn mới. Bấm **+** món khác → chọn **YES, đổi** để thay món. |
| Xoá dữ liệu trang (localStorage) → trang coi bạn là người mới | Đơn cũ vẫn nằm trong danh sách; xoá tay bằng ✕ rồi đặt lại, hoặc dùng nút đổi món nếu đã đặt. |
| Tick NEW ở Setup nhưng trang đặt cơm không đổi | Tải lại trang (Ctrl+F5); kiểm tra Console xem có lỗi `42703` ở trên không. |
| Bấm ★ không thấy bình luận / lỗi `relation "reviews" does not exist` | Chưa chạy phần `MIGRATION: Đánh giá món` trong `schema.sql`. |
| Chat báo "Chưa tạo bảng chat_messages" | Chưa chạy phần `MIGRATION: Chat nội bộ` trong `schema.sql`. |
| Tin nhắn chat không hiện realtime giữa các máy | Bảng `chat_messages` chưa được thêm vào publication — chạy lại phần migration. |
| Mũi tên vòng quay chỉ sai món | Đã sửa ở bản mới (gán transform một lần + chờ `transitionend`). Ctrl+F5 để lấy bản mới. |
| Đánh giá không hiện realtime giữa các máy | Chưa thêm bảng `reviews` vào publication — chạy lại phần migration. |
| Upload ảnh lỗi `new row violates row-level security` | Policy storage chưa có — chạy lại `schema.sql`. |
| Ảnh upload xong nhưng không hiện | Bucket chưa public — trong Dashboard → Storage → `dish-images` → Public = on. |
| Copy báo "Không copy được" | Trình duyệt chặn clipboard khi mở bằng `file://`; chạy qua `http://localhost` hoặc HTTPS. |
| Danh sách trống dù vừa đặt | Máy đó có ngày khác (múi giờ) — kiểm tra đồng hồ hệ thống. |
| Món NEW không có viền chạy | Trình duyệt cũ không hỗ trợ `@property` hoặc đang bật giảm chuyển động — viền màu tĩnh vẫn hiện, không phải lỗi. |
| Panel thời tiết trống / ẩn | Không gọi được `api.open-meteo.com` (chặn mạng/firewall). Block gợi ý món cũng ẩn; trang đặt cơm không bị ảnh hưởng. |
| Gợi ý món không có câu lời khuyên AI | Chưa deploy Edge Function `weather-suggest` hoặc chưa set `OPENROUTER_API_KEY`. Trang vẫn hiện câu gợi ý theo luật thời tiết. Xem log ở Dashboard → Edge Functions. |
| Trên localhost không thấy câu lời khuyên AI | Mở DevTools → Network, xem request `.../functions/v1/weather-suggest`: `404` → chưa deploy function; `CORS`/`Failed to fetch` → thêm `http://localhost:8000` vào `ALLOWED_ORIGIN` (hoặc `*`); `502` → đọc `detail`. Trang tự thử lại sau ~2 phút. |
| Lời khuyên AI ghi "(cũ)" | AI đang lỗi/hết lượt nên trang dùng lại lời khuyên gần nhất (< 24h). Tự thử lại sau ~1 giờ; xoá `dedatcom_ai_suggest_v1` trong localStorage nếu muốn thử ngay. |
| Khung Hỏi AI báo lỗi | Đọc bong bóng đỏ — lý do ngắn (chưa deploy function / key sai / AI quá tải). Hội thoại nằm ở `dedatcom_ai_chat` trong localStorage, bấm **Xoá** để reset. |
| Function trả 502 | Nhà cung cấp AI lỗi/hết quota/sai model. Đọc `status` + `detail` + `hint` + `tried` trong response, soát secret rồi xem log ở Dashboard → Edge Functions. |
| Function trả 502 + `status: 404` | Model không tồn tại/hết lượt free ở OpenRouter. Đổi `LLM_MODEL`/`LLM_MODELS` sang model khác (xem danh sách ở <https://openrouter.ai/models?max_price=0>). Không cần deploy lại. |
| Function trả 502 + `status: 429` lặp lại | Hết hạn mức free (request/phút hoặc /ngày). Function đã tự retry 2 lần; thêm model vào `LLM_MODELS` để tự chuyển, hoặc chờ hạn mức reset. |
| Function trả 502 + `status: 401`/`403` | `OPENROUTER_API_KEY` sai/hết hiệu lực — tạo key mới ở <https://openrouter.ai/keys> rồi `supabase secrets set OPENROUTER_API_KEY=...`. |
| Function trả 502 + `status: 402` | OpenRouter báo hết credit cho model đó — đổi `LLM_MODELS`. |
| Gợi ý AI trùng/không đổi sau khi sửa thời tiết | Cache 60 phút theo ngày + loại thời tiết + danh sách món. Xoá `dedatcom_ai_suggest_v1` trong localStorage nếu cần làm mới ngay. |
