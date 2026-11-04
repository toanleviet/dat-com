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
  4 khung giờ kế tiếp (nhiệt độ · độ ẩm · lượng mưa mm), và tóm tắt **chiều tối 17–20h**
  (nhiệt độ TB, độ ẩm TB, **tổng lượng mưa mm** + nhãn 🟡 mưa nhẹ / 🔴 mưa to). Sau 20h thì
  chuyển thành dự báo **chiều mai**.
- Dữ liệu lấy từ Open-Meteo, tự cập nhật mỗi ~10 phút (cache trình duyệt). Không có mạng
  thì panel hiện dữ liệu cũ (ghi rõ giờ) hoặc ẩn đi — trang đặt cơm vẫn dùng bình thường.

### Vì sao dùng mm thay vì % mưa

- `% mưa` của nhà cung cấp là **khả năng có mưa ở đâu đó trong vùng rộng ~11 km**, không phải
  khả năng bạn bị ướt → TP.HCM mùa mưa gần như ngày nào cũng ≥ 60%, gây cảm giác "báo mưa mà không mưa".
- App phân loại theo **lượng mưa thật (mm) trong khung 17–20h**:
  - **≥ 5 mm (≈ 25 mm/ngày)** → coi là **mưa**, ưu tiên món nước.
  - **2 – < 5 mm** → chỉ ghi chú "mưa nhẹ", **không** đổi nhóm món.
  - **< 2 mm** → coi như không mưa.
- `%` vẫn hiện trong tooltip để tham khảo.

### Ngưỡng mưa tham khảo (thang 24h của NCHMF)

| 24h | Cấp | Ghi chú |
| --- | --- | --- |
| < 10 mm | mưa nhỏ | ướt đường, không cần áo mưa |
| 10–<50 mm | mưa vừa | cần áo mưa, đọng nước |
| 50–<100 mm | mưa to | ngập cục bộ |
| ≥ 100 mm | rất to | ngập diện rộng |

(60 ngày qua tại Quận 4: cao nhất 41.6 mm, không có ngày nào ≥ 50 mm.)

- Block **"🍽️ Món gợi ý theo thời tiết"** nằm **trên đầu danh sách món**:
  - Một câu mô tả theo thời tiết hiện tại (chiều tối 17–20h, hoặc chiều mai nếu đã quá 20h).
  - Món gợi ý chọn bằng **luật từ khoá** trên menu của **cả Hải Nam và Dejavu**:
    mưa hoặc mát → món nước/nóng (mì, bún, phở, hủ tiếu, miến, cháo, canh, súp, lẩu, kho, nướng);
    nóng hoặc nóng ẩm → món mát (trộn, gỏi, nộm, cuốn, salad, chè, sinh tố, đồ chua).
  - Điểm đánh giá cao được xếp lên trước khi cùng khớp từ khoá.
  - **Nhấp thẳng vào thẻ món** để đặt (không cần nút `+`); rê chuột lên thẻ thì thẻ sáng lên.
    Thẻ của món bạn đã đặt sẽ mờ đi và không bấm được.
  - Vẫn tuân thủ **1 món/người/ngày**, và món không thuộc menu đang mở có ghi kèm tên quán.

## Món đặt nhiều

- Card **🔥 Món đặt nhiều** nằm ngay **dưới card Thời tiết** (cột trái; mobile: đầu trang).
- Top **10 món** có nhiều lượt đặt nhất trong **30 ngày gần nhất**, tính trên đơn của tất cả mọi người.
- Mỗi dòng hiện hạng (🥇🥈🥉 cho 3 món đầu), tên món, tên quán và số lượt `×N` kèm thanh tỉ lệ.
- Nhấp vào dòng món còn trong menu để đặt; món đã bị xoá khỏi menu vẫn hiện số liệu nhưng không bấm được.
- Danh sách tự cập nhật trong ~2 giây khi có người đặt hoặc xoá đơn.

## Chốt đơn hằng ngày

- Mỗi ngày **T2–T6**, đơn tự **chốt lúc 18:00**. Sau mốc này: không đặt mới, không đổi món,
  không xoá đơn của ngày hôm đó. Banner 🔒 xuất hiện trên khung "Chọn món".
- **Thứ 7 và Chủ nhật không chốt** (ngày nghỉ) — nếu có ai đặt vào cuối tuần, đơn vẫn được ghi
  và hiện trong lịch sử.
- Ngày đã qua luôn ở trạng thái chỉ-xem. Muốn đặt bù sau giờ chốt thì phải chờ hôm sau (hoặc
  sửa trực tiếp trong Supabase — xem `docs/xu-ly-su-co.md`).
- Đổi giờ chốt: sửa `CUTOFF_HOUR` / `CUTOFF_WEEKDAYS` trong `js/config.js`.

## Lịch sử đơn

- Bấm **📜 Lịch sử đơn** trên thanh trên cùng (cũng có trong `setup.html`).
- Trang `history.html` hiện **theo tháng**, nhóm theo **ngày → từng người**: tên người, món, quán.
- Ngày làm việc có nhãn `🔒 chốt 18:00`; cuối tuần có nhãn `cuối tuần`.
- Đổi tháng bằng ô chọn tháng; tổng số ngày/đơn/người hiện ở góc phải thanh công cụ.
- Lịch sử chỉ để xem — không sửa/xoá được từ trang này.
- Lưu ý: nút **Xoá toàn bộ đơn** ở `setup.html` xoá **tất cả** đơn (kể cả lịch sử).

## Popup nhắc đặt cơm

- Mỗi ngày làm việc, trong khung **16:30 → 18:00**, nếu bạn **chưa đặt món** thì hiện popup
  "🍚 Đặt cơm ae ơi!!!" kèm số phút còn lại tới giờ chốt.
- **Đặt ngay**: đóng popup và cuộn tới danh sách món.
- **Để sau 15'**: ẩn 15 phút rồi nhắc lại (chỉ khi vẫn trong khung 16:30–18:00).
- Mỗi ngày chỉ nhắc lại nếu bạn chưa đặt; đã đặt món thì không hiện. Thứ 7/CN không hiện.
- Trạng thái lưu ở `localStorage` (`dedatcom_remind`); xoá key này nếu muốn thấy popup lại.

## Thông báo chat

- Khi có người khác gửi tin trong Chat nội bộ, một **toast** trượt vào góc dưới phải (giống
  Microsoft Teams): avatar chữ cái, tên người gửi, giờ, nội dung 2 dòng.
- Bấm vào toast → cuộn tới tin đó và làm nổi bật tin (viền vàng nhấp nháy).
- Tự ẩn sau 6 giây (rê chuột vào thì tạm dừng), tối đa 3 toast cùng lúc.
- Tin do chính bạn gửi không tạo toast.

### Thông báo trên Windows khi thu nhỏ tab

- Bấm nút **🔕** trên thanh trên cùng → chọn **Cho phép** khi trình duyệt hỏi. Nút đổi thành **🔔**.
- Từ đó, nếu **tab đang bị thu nhỏ/ở nền**, tin nhắn mới của người khác sẽ hiện thành
  **thông báo Windows** (góc màn hình) kèm tên người gửi và nội dung.
- Bấm vào thông báo → quay lại tab và nhảy tới đúng tin.
- Khi tab đang mở thì chỉ hiện toast trong trang (tránh 2 thông báo trùng).
- Bấm 🔔 lần nữa để tắt.

**Điều kiện để dùng được:**

| Điều kiện | Ghi chú |
| --- | --- |
| Trang chạy **HTTPS** hoặc **localhost** | `http://<IP-LAN>` **không** dùng được — cần deploy (Netlify/GitHub Pages) hoặc tunnel |
| Trình duyệt đang chạy (kể cả thu nhỏ) | Tắt hẳn trình duyệt thì không có thông báo |
| Windows cho phép thông báo cho Edge/Chrome | Settings → System → Notifications → bật, tắt Focus assist |
| Đã bấm Cho phép | Nếu lỡ bấm Chặn: bấm biểu tượng ổ khoá trên thanh địa chỉ → Notifications → Allow |

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
