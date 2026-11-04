# 🍚 Đặt cơm công ty

Web tĩnh (HTML/CSS/JS thuần, không build) + Supabase, để cả công ty chọn món cho bữa trưa:
ai cũng thấy danh sách đơn của **hôm nay** cập nhật realtime, người tổng hợp bấm **Copy danh sách** gửi sếp.

Cú pháp mỗi dòng khi copy:

```
Cơm sườn_(Hải Nam) - An
```

## Có gì

- **Đặt cơm** — chọn menu (Hải Nam / Dejavu), mỗi người **1 món / ngày**, đổi món có xác nhận.
- **Realtime** — đơn và đánh giá cập nhật giữa mọi máy, không cần tải lại.
- **Lọc món** — gõ có dấu hay không dấu đều đúng (`com` = `cơm`).
- **Gợi ý món cho tui!!!** — vòng quay Lucky Food chọn ngẫu nhiên món trong tất cả menu.
- **Đánh giá món** — chấm 1–5 sao, bình luận, điểm trung bình ngay trên card.
- **Nhãn NEW** — tick ở trang Setup: món viền gradient chạy, nhãn NEW phát sáng, luôn đứng đầu menu.
- **Gợi ý món theo thời tiết TP.HCM** — panel trái hiện thời tiết hiện tại + mưa chiều tối,
  đầu danh sách món gợi ý tối đa 10 món hợp thời tiết (luật từ khoá, không cần API key).
- **Chat nội bộ** — một phòng chat chung cho cả công ty, có toast thông báo kiểu Teams.
- **Chốt đơn 18:00** — T2–T6 khoá đặt/đổi/xoá đơn sau giờ chốt; trang **Lịch sử đơn** xem lại
  theo tháng; popup nhắc "Đặt cơm ae ơi!!!" lúc 16:30.
- **Import CSV** — thêm hàng loạt món, có xem trước và bỏ qua món trùng.
- **Copy danh sách** — xuất text đúng cú pháp để dán vào Word/Slack.

## Cài đặt trong 5 bước

1. Tạo project trên <https://supabase.com> (region Singapore).
2. Mở **SQL Editor** → dán toàn bộ `supabase/schema.sql` → **Run**.
3. Copy **Project URL** + **anon public key** → dán vào `js/config.js`.
4. Mở `index.html`, hoặc chạy `python -m http.server 8000` rồi vào <http://localhost:8000>.
5. Chia sẻ link cho mọi người (hướng dẫn deploy ở bảng dưới).

> **Đã có database từ bản cũ?** Chạy lại (hoặc chỉ chạy phần `MIGRATION:` liên quan) trong `supabase/schema.sql`. File idempotent, chạy lại nhiều lần an toàn.

## Tài liệu chi tiết

| Chủ đề | File |
| --- | --- |
| Cài đặt Supabase, `config.js`, bảng dữ liệu, nâng cấp schema | [docs/cai-dat.md](docs/cai-dat.md) |
| Sử dụng hằng ngày: đặt cơm, lọc, vòng quay, đánh giá, nhãn NEW, chat, Setup | [docs/su-dung.md](docs/su-dung.md) |
| Import món từ CSV | [docs/import-csv.md](docs/import-csv.md) |
| Deploy (GitHub Pages / Netlify) + cấu trúc file | [docs/trien-khai.md](docs/trien-khai.md) |
| Xử lý sự cố, rủi ro & giới hạn | [docs/xu-ly-su-co.md](docs/xu-ly-su-co.md) |

## Lưu ý bảo mật

Trang **không có đăng nhập, không có mật khẩu**. Ai có link đều xem / thêm / xóa đơn, sửa món và đánh giá được.
Tool chỉ phù hợp chia sẻ **nội bộ**; muốn an toàn hơn thì bật Supabase Auth hoặc chặn link nội bộ.

## Cấu trúc file

```
index.html          trang đặt cơm
setup.html          trang quản lý món + xóa dữ liệu
css/style.css
js/config.js        SUPABASE_URL, SUPABASE_ANON_KEY (điền tay)
js/app.js           đặt cơm + list realtime + copy + vòng quay + đánh giá
js/setup.js         CRUD món + upload ảnh + import CSV + xóa dữ liệu
supabase/schema.sql bảng + RLS + bucket + realtime + seed + migrations
docs/               tài liệu chi tiết
```
