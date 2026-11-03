[← Về README](../README.md)

# Sử dụng hằng ngày

## Trang đặt cơm — `index.html`

1. Lần đầu nhập tên (lưu vào `localStorage` key `dedatcom_person`, lần sau tự điền).
   Bấm chip tên trên header để đổi tên.
   - **Đổi tên an toàn**: đơn gắn với **trình duyệt** (id ngẫu nhiên lưu ở
     `dedatcom_person_id`), không gắn với chuỗi tên. Đổi tên chỉ đổi nhãn hiển thị:
     không sinh đơn thứ 2, không mất món đã chọn, và không ảnh hưởng đơn của người
     khác (kể cả khi hai người trùng tên).
   - Dùng chung máy hoặc xoá dữ liệu trình duyệt thì mất liên kết với đơn cũ —
     đơn vẫn nằm trong danh sách, xoá tay bằng nút ✕ nếu cần.
2. Bấm **Menu Hải Nam** / **Menu Dejavu** → bấm **+** trên món để đặt.
   - **Lọc món**: ô tìm kiếm phía trên danh sách món. Gõ "cơm" hoặc "com" (không dấu)
     đều lọc đúng; `Esc` hoặc nút ✕ để xoá lọc. Bộ đếm hiện `3/6 món`.
   - **Mỗi người chỉ được chọn 1 món / ngày.** Đã chọn rồi mà bấm món khác sẽ hiện
     hộp thoại **"Bạn đã chọn món rồi"** với 2 nút **YES, đổi** / **NO, giữ**.
     YES → thay đơn cũ bằng món mới; NO → không đổi gì.
   - Thanh **"Bạn hôm nay: …"** phía trên danh sách món cho biết món bạn đang chọn.
   - Nút bị disable khi request đang chạy (chống double-click tạo đơn trùng).
   - Đặt xong nút thành **✓**, card viền xanh, các card khác bị làm mờ.
3. **Gợi ý món cho tui!!!** — nút gradient nhiều màu nằm ngay **trên cùng khung "Chọn món"**.
   Bấm → mở **Lucky Food** với vòng quay chứa toàn bộ món đang bán (cả 2 menu).
   Bấm **QUAY NGAY** → bánh xe quay ~3.5 giây → hiện món được chọn kèm hộp thoại
   **"Bạn muốn chọn món này chứ?"** (YES / NO).
   - YES → đặt món đó (nếu đã có món khác thì hỏi thêm 1 lần để đổi).
   - NO → giữ nguyên, có thể quay lại.
4. Panel **Đơn hôm nay** ở bên phải (mobile: phía dưới) tự cập nhật realtime.
5. **Ai cũng có thể xóa bất kỳ đơn nào** — mỗi dòng đơn đều có nút **✕** kèm hộp
   thoại xác nhận hiện tên món và tên người đã đặt.
6. **Copy danh sách** → dán vào Word/Slack/Notepad, mỗi dòng đúng cú pháp
   `<Tên món>_(<tên quán>) - <tên người đặt>`.

Danh sách chính chỉ hiển thị đơn của **ngày hiện tại theo giờ máy** (trường
`order_date = YYYY-MM-DD` local). Sang ngày mới danh sách tự trống.

## Thời tiết & món gợi ý

- Cột **bên trái** (mobile: đầu trang) hiện thời tiết **TP.HCM**: nhiệt độ + độ ẩm hiện tại,
  4 khung giờ kế tiếp (nhiệt độ · độ ẩm · % mưa), và tóm tắt **chiều tối 17–20h**
  (nhiệt độ TB, độ ẩm TB, xác suất mưa cao nhất). Sau 20h thì chuyển thành dự báo **chiều mai**.
- Dữ liệu lấy từ Open-Meteo, tự cập nhật mỗi ~10 phút (cache trình duyệt). Không có mạng
  thì panel hiện dữ liệu cũ (ghi rõ giờ) hoặc ẩn đi — trang đặt cơm vẫn dùng bình thường.
- Block **"🍽️ Món gợi ý theo thời tiết"** nằm **trên đầu danh sách món**:
  - Một câu lời khuyên (1–2 câu) đọc thời tiết và **toàn bộ menu của cả Hải Nam và Dejavu**.
  - Món gợi ý do AI chọn trong menu đang bán (tối đa 6); nếu AI tạm lỗi thì dùng luật thời tiết
    (nóng → trộn/gỏi/cuốn; mưa hoặc mát → món nước như mì, bún, phở, hủ tiếu, miến, cháo,
    canh, súp, lẩu) và lời khuyên mẫu.
  - Tổng **tối đa 10 món**: món AI chọn xếp trước, sau đó bổ sung các món hợp thời tiết còn lại
    (không trùng).
  - Bấm **+** ngay trên chip gợi ý để đặt món — vẫn tuân thủ **1 món/người/ngày**, và món
    không thuộc menu đang mở có ghi kèm tên quán.

## Hỏi AI

- Khung **🤖 Hỏi AI** nằm ngay **dưới card Thời tiết** (cột trái; mobile: đầu trang).
- Gõ câu hỏi tự do, vd *"tôi dị ứng hải sản, ăn gì?"*, *"món nào nhẹ bụng?"*, *"hôm nay mưa,
  có gì nóng?"*. AI trả lời dựa trên thời tiết hiện tại + menu của **cả hai quán**.
- AI chỉ tư vấn trong menu đang bán, không bịa món.
- Lịch sử hội thoại **chỉ lưu trên máy bạn** (`localStorage`), tối đa 20 tin, tự xoá sau 7 ngày
  hoặc khi bấm **Xoá**. Câu hỏi được gửi lên máy chủ AI (không kèm tên người dùng).
- Khi AI lỗi/hết lượt, bong bóng trả lời sẽ ghi lý do ngắn; trang không bị treo.

## Nhãn NEW cho món mới

Món mới nhập về có thể được gắn nhãn **NEW** để mọi người dễ thấy.

- **Bật/tắt ở trang Setup**: tick ô *"Món mới — gắn nhãn NEW…"* trong form thêm/sửa món.
  Không tự hết hạn — tự bỏ tick khi món đã quen.
- Trên trang đặt cơm, card món NEW có **viền gradient chạy** + **nhãn NEW** góc trên trái
  ảnh; nút ★ ở góc dưới phải nên không chồng nhau.
- Món NEW **luôn đứng đầu** menu đó. Giữa các món NEW vẫn xếp theo *Thứ tự* (`sort_order`).
- Tắt nhãn → món về đúng vị trí theo `sort_order`.
- Danh sách ở trang Setup hiện nhãn **NEW** nhỏ cạnh tên (không có hiệu ứng) để dễ quản lý.
- Vòng quay **không** ưu tiên món NEW; món import CSV mặc định không NEW.
- Nên chỉ bật 2–3 món cùng lúc để card không rối mắt.

Người bật *giảm chuyển động* (`prefers-reduced-motion`) sẽ thấy viền màu tĩnh thay vì chạy.

## Đánh giá món

- Mỗi card món có nút **★** ở góc dưới bên phải ảnh: chưa có đánh giá thì nút tròn chỉ có
  icon ★; đã có đánh giá thì hiện điểm trung bình (VD `4.5`).
- Bấm **★** → mở hộp **Đánh giá món**: điểm trung bình, chọn 1–5 sao, nhận xét
  (không bắt buộc, tối đa 300 ký tự), **Gửi đánh giá**.
- Bên dưới là danh sách bình luận (sao, tên người, thời gian, nội dung), mới nhất
  ở trên. Mọi người xem được đánh giá của nhau, realtime.
- Ai cũng xóa được một đánh giá (nút ✕, có xác nhận).
- Một người có thể đánh giá một món nhiều lần (mỗi lần 1 dòng); điểm trung bình
  tính trên tất cả các dòng.
- Khi xóa món ở trang Setup, đánh giá của món đó bị xóa theo.

## Chat nội bộ

- Panel **💬 Chat** là **cột riêng bên phải** (sau cột Đơn hôm nay) trên desktop, cao bằng
  màn hình và có vùng cuộn riêng nên danh sách đơn dài không làm chat bị bóp nhỏ.
  Trên màn hình hẹp chat xuống dưới cùng.
- Mọi người dùng chung phòng chat theo link. Tin nhắn realtime, hiển thị tên người gửi,
  giờ gửi; tin của bạn nằm bên phải, tin người khác bên trái.
- Tối đa **300 ký tự**/tin, hiển thị 80 tin gần nhất.
- Ai cũng xoá được tin nhắn (nút ✕ hiện khi rê chuột, có xác nhận).
- Cần chạy phần `MIGRATION: Chat nội bộ` trong `schema.sql` trước.

## Trang quản lý — `setup.html`

- Thêm món: tên, thuộc quán, thứ tự, **nhãn NEW**, ảnh (tùy chọn).
- **Ai cũng có quyền** thêm / sửa / ẩn / bật / xóa món (trang không có mật khẩu).
- Sửa: đổi tên / quán / thứ tự / nhãn NEW / ảnh.
- **Ẩn** hoặc **Bật** món (`is_available`) — món ẩn không hiện ở trang đặt cơm.
- **Xóa món**: đơn đã đặt vẫn giữ tên món nhờ cột snapshot `dish_name`,
  `restaurant_name` trong bảng `orders`.
- Ảnh upload lên bucket `dish-images`, giới hạn **2MB**, chỉ file `image/*`.
  Không có ảnh → hiện placeholder gradient + chữ viết tắt tên món.
- **Import hàng loạt từ CSV** — xem [import-csv.md](import-csv.md).
- **Xóa toàn bộ đơn** — reset thủ công khi sang tháng mới: xác nhận 2 bước
  (confirm + gõ `XOA`).

## Reset tháng

Dữ liệu cũ **bị xóa hẳn**, không có trang history.

- **Thủ công (khuyến nghị)**: trang `setup.html` → **Xóa toàn bộ đơn**.
- **Tự động (tuỳ chọn)**: bật extension `pg_cron` rồi bỏ comment khối cuối
  trong `supabase/schema.sql` (job chạy 1h sáng mỗi ngày, xóa đơn cũ hơn 31 ngày).
  Free tier tùy project có thể không bật được — nếu lỗi thì dùng nút thủ công.

> Lưu ý: nút "Xóa toàn bộ đơn" xóa **mọi đơn ở mọi ngày**, không chỉ đơn
> của ngày hôm nay. Đó là hành vi mong muốn khi reset tháng.
