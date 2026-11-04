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
| Ngày nào cũng gợi ý món nước | Đã sửa: phân loại theo **lượng mưa mm** (≥5 mm trong 17–20h) thay cho % mưa. Nếu vẫn lệch, xem `evening.rainMm` trong Console → `state.weather`. Muốn nhạy/ì hơn: sửa `RAIN_HEAVY_MM` / `RAIN_LIGHT_MM` trong `js/weather.js`. |
| Dự báo mưa nhưng trời không mưa | `% mưa` là khả năng có mưa **ở đâu đó trong vùng ~11 km**, không phải tại chỗ bạn đứng; mưa rào rất cục bộ. Nay app chỉ đổi nhóm món khi lượng mưa thật ≥ 5 mm/khung 3h. |
| Block gợi ý món không hiện | Không có món nào trong menu khớp từ khoá thời tiết (mưa → món nước, nóng → món mát). Thêm món phù hợp hoặc mở rộng `COOL_KEYWORDS`/`HOT_KEYWORDS` trong `js/weather.js`. |
| Gợi ý ít hơn 10 món | Đúng thiết kế: chỉ lấy món khớp từ khoá, không bổ sung món ngoài luật. |
| Bị khoá đặt nhưng cần đặt bù | Đã qua 18:00 ngày làm việc. Chờ hôm sau, hoặc thêm trực tiếp trong Supabase → Table `orders` (nhớ `order_date`, `person_name`, `dish_name`, `restaurant_name`). |
| Khoá quá sớm / quá muộn | Kiểm tra giờ hệ thống của máy. Đổi mốc: `CUTOFF_HOUR`, `CUTOFF_WEEKDAYS` trong `js/config.js`. |
| Popup 16:30 không hiện | Chưa nhập tên, đã đặt món hôm nay, ngoài khung 16:30–18:00, là cuối tuần, hoặc đã bấm "Để sau". Xoá key `dedatcom_remind` trong localStorage để thử lại. |
| Trang Lịch sử trống | Chọn đúng tháng; kiểm tra Console (lỗi quyền `orders read` → chạy lại `schema.sql`). |
| Không có toast khi có tin mới | Tin của chính bạn thì không toast; cũng cần chạy phần `MIGRATION: Chat nội bộ` và realtime cho bảng `chat_messages`. |
| Không thấy thông báo trên Windows | 1) Trang phải là HTTPS/localhost (truy cập `http://<IP>` thì trình duyệt chặn). 2) Chưa bấm 🔔 / đã bấm Chặn. 3) Windows tắt thông báo cho Edge/Chrome hoặc bật Focus assist. 4) Tab đang mở (khi đó chỉ có toast trong trang). |
| Nút 🔔 bị ẩn | Trình duyệt không hỗ trợ Notification API (rất cũ), hoặc trang chạy trên `http://` không bảo mật. |