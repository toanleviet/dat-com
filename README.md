# Tool đặt cơm công ty

Web tĩnh (HTML/CSS/JS thuần, không build) + Supabase để nhân viên đặt cơm từ menu
**Hải Nam** và **Dejavu**. Danh sách đơn của **hôm nay** cập nhật realtime giữa mọi máy,
người tổng hợp bấm **Copy danh sách** để gửi sếp.

Cú pháp mỗi dòng:

```
Cơm sườn_(Hải Nam) - An
```

---

## 1. Cài đặt Supabase (làm 1 lần, bắt buộc)

1. Vào <https://supabase.com> → đăng nhập → **New project**.
   - Name: `dat-com` (tùy ý), Region: `Southeast Asia (Singapore)`.
   - Lưu lại **Database password** (không dùng đến nhưng phải giữ).
2. Đợi project khởi tạo xong (~2 phút).
3. Mở **SQL Editor** → **New query** → dán **toàn bộ** nội dung file
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   - File tạo 4 bảng: `restaurants`, `dishes`, `orders`, `reviews`; bật RLS + policy;
     tạo bucket `dish-images` (public); bật realtime; seed 2 quán + 12 món mẫu.
   - Chạy lại file này nhiều lần cũng an toàn (idempotent).

> **Đã có database từ phiên bản trước (chưa có bảng `reviews`)?**
> Chạy lại toàn bộ `schema.sql`. Phần `MIGRATION: Đánh giá món` tạo bảng
> `reviews`; phần realtime đã được bọc `do $$ ... $$` nên không còn lỗi
> `42710: relation ... is already member of publication` khi chạy lần hai.
4. Mở **Project Settings → API** (hoặc **Project Settings → API Keys**), copy:
   - **Project URL** — dạng `https://xxxxx.supabase.co`
   - **anon public** key (JWT dài)
5. Mở `js/config.js`, điền:

```js
export const SUPABASE_URL = "https://xxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

> Không cần tạo user, không cần đăng nhập. Nếu 2 giá trị này để trống,
> trang sẽ hiện banner hướng dẫn thay vì bị lỗi.

---

## 2. Chạy thử

**Cách A – mở trực tiếp:** double-click `index.html`.
Hoạt động được, nhưng nên dùng cách B để clipboard và một số API trình duyệt
hoạt động ổn định.

**Cách B – chạy server tĩnh (khuyến nghị):**

```powershell
cd D:\DatCom
python -m http.server 8000
```

Mở <http://localhost:8000>. Trên Windows có thể dùng `py -m http.server 8000`
hoặc `npx serve` nếu không có Python.

---

## 3. Sử dụng

### Trang đặt cơm — `index.html`

1. Lần đầu nhập tên (lưu vào `localStorage` key `dedatcom_person`, lần sau tự điền).
   Bấm chip tên trên header để đổi tên.
2. Bấm **Menu Hải Nam** / **Menu Dejavu** → bấm **+** trên món để đặt.
   - Nút bị disable khi request đang chạy (chống double-click tạo đơn trùng).
   - Đặt xong nút thành **✓**, card viền xanh.
3. Panel **Đơn hôm nay** ở bên phải (mobile: phía dưới) tự cập nhật realtime.
4. **Ai cũng có thể xóa bất kỳ đơn nào** — mỗi dòng đơn đều có nút **✕** kèm hộp
   thoại xác nhận hiện tên món và tên người đã đặt.
5. **Copy danh sách** → dán vào Word/Slack/Notepad, mỗi dòng đúng cú pháp
   `<Tên món>_(<tên quán>) - <tên người đặt>`.

### Đánh giá món

- Mỗi card món có nút **★** ở góc dưới bên phải ảnh: chưa có đánh giá hiện `Mới`,
  đã có hiện điểm trung bình (VD `4.3`).
- Bấm **★** → mở hộp **Đánh giá món**: điểm trung bình, chọn 1–5 sao, nhận xét
  (không bắt buộc, tối đa 300 ký tự), **Gửi đánh giá**.
- Bên dưới là danh sách bình luận (sao, tên người, thời gian, nội dung), mới nhất
  ở trên. Mọi người xem được đánh giá của nhau, realtime.
- Ai cũng xóa được một đánh giá (nút ✕, có xác nhận).
- Một người có thể đánh giá một món nhiều lần (mỗi lần 1 dòng); điểm trung bình
  tính trên tất cả các dòng.
- Khi xóa món ở trang Setup, đánh giá của món đó bị xóa theo.

Danh sách chính chỉ hiển thị đơn của **ngày hiện tại theo giờ máy** (trường
`order_date = YYYY-MM-DD` local). Sang ngày mới danh sách tự trống.

### Trang quản lý — `setup.html`

- Thêm món: tên, thuộc quán, thứ tự, ảnh (tùy chọn).
- **Ai cũng có quyền** thêm / sửa / ẩn / bật / xóa món (trang không có mật khẩu).
- Sửa: đổi tên / quán / thứ tự / ảnh.
- **Ẩn** hoặc **Bật** món (`is_available`) — món ẩn không hiện ở trang đặt cơm.
- **Xóa món**: đơn đã đặt vẫn giữ tên món nhờ cột snapshot `dish_name`,
  `restaurant_name` trong bảng `orders`.
- Ảnh upload lên bucket `dish-images`, giới hạn **2MB**, chỉ file `image/*`.
  Không có ảnh → hiện placeholder gradient + chữ viết tắt tên món.
- **Xóa toàn bộ đơn** — reset thủ công khi sang tháng mới: xác nhận 2 bước
  (confirm + gõ `XOA`).

---

## 4. Reset tháng

Dữ liệu cũ **bị xóa hẳn**, không có trang history.

- **Thủ công (khuyến nghị)**: trang `setup.html` → **Xóa toàn bộ đơn**.
- **Tự động (tuỳ chọn)**: bật extension `pg_cron` rồi bỏ comment khối cuối
  trong `supabase/schema.sql` (job chạy 1h sáng mỗi ngày, xóa đơn cũ hơn 31 ngày).
  Free tier tùy project có thể không bật được — nếu lỗi thì dùng nút thủ công.

> Lưu ý: nút "Xóa toàn bộ đơn" xóa **mọi đơn ở mọi ngày**, không chỉ đơn
> của ngày hôm nay. Đó là hành vi mong muốn khi reset tháng.

---

## 5. Deploy

Đây là site tĩnh, deploy được ở bất kỳ static hosting nào.

### GitHub Pages

```powershell
git init
git add .
git commit -m "Init dat com tool"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

GitHub → repo → **Settings → Pages** → Source: `Deploy from a branch`,
Branch: `main` / `/ (root)` → Save. URL dạng `https://<user>.github.io/<repo>/`.

### Netlify

Kéo thả thư mục `D:\DatCom` vào <https://app.netlify.com/drop>. Không cần
build command. (Nhớ đã điền `js/config.js` trước khi deploy.)

> anon key nằm trong file public là **bình thường** với Supabase — nó không
> phải secret, bảo mật do RLS quyết định.

---

## 6. Cấu trúc file

```
index.html          trang đặt cơm
setup.html          trang quản lý món + xóa dữ liệu
css/style.css
js/config.js        SUPABASE_URL, SUPABASE_ANON_KEY (điền tay)
js/supabase-client.js
js/app.js           đặt cơm + list realtime + copy + đánh giá món
js/setup.js         CRUD món + upload ảnh + xóa dữ liệu
js/placeholder.js   sinh ảnh placeholder từ tên món
supabase/schema.sql bảng + RLS + bucket + realtime + seed
README.md
```

Thư viện `@supabase/supabase-js` tải qua ESM CDN (`https://esm.sh/@supabase/supabase-js@2`),
không cần `npm install`.

---

## 7. Rủi ro & giới hạn đã chấp nhận

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

---

## 8. Xử lý sự cố

| Hiện tượng | Nguyên nhân / cách sửa |
| --- | --- |
| Banner "Chưa cấu hình Supabase" | Điền `SUPABASE_URL` + `SUPABASE_ANON_KEY` trong `js/config.js`, tải lại trang (Ctrl+F5). |
| "Không kết nối được Supabase" | Sai URL/key, hoặc chưa chạy `schema.sql`. Xem Console trình duyệt (F12). |
| Danh sách không tự cập nhật giữa các máy | Chưa bật realtime cho `orders` — chạy lại phần realtime trong `schema.sql`. |
| Bấm ★ không thấy bình luận / lỗi `relation "reviews" does not exist` | Chưa chạy phần `MIGRATION: Đánh giá món` trong `schema.sql`. |
| Đánh giá không hiện realtime giữa các máy | Chưa thêm bảng `reviews` vào publication — chạy lại phần migration. |
| Upload ảnh lỗi `new row violates row-level security` | Policy storage chưa có — chạy lại `schema.sql`. |
| Ảnh upload xong nhưng không hiện | Bucket chưa public — trong Dashboard → Storage → `dish-images` → Public = on. |
| Copy báo "Không copy được" | Trình duyệt chặn clipboard khi mở bằng `file://`; chạy qua `http://localhost` hoặc HTTPS. |
| Danh sách trống dù vừa đặt | Máy đó có ngày khác (múi giờ) — kiểm tra đồng hồ hệ thống. |
