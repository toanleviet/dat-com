[← Về README](../README.md)

# Cài đặt & cấu hình

## 1. Tạo Supabase project (làm 1 lần, bắt buộc)

1. Vào <https://supabase.com> → đăng nhập → **New project**.
   - Name: `dat-com` (tùy ý), Region: `Southeast Asia (Singapore)`.
   - Lưu lại **Database password** (không dùng đến nhưng phải giữ).
2. Đợi project khởi tạo xong (~2 phút).
3. Mở **SQL Editor** → **New query** → dán **toàn bộ** nội dung file
   [`supabase/schema.sql`](../supabase/schema.sql) → **Run**.
   - File tạo 4 bảng: `restaurants`, `dishes`, `orders`, `reviews`; bật RLS + policy;
     tạo bucket `dish-images` (public); bật realtime; seed 2 quán + 12 món mẫu
     (**chỉ khi bảng `dishes` còn trống** — chạy lại file sẽ không thêm món mẫu trở lại).
   - Chạy lại file này nhiều lần cũng an toàn (idempotent).
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

## 3. Bảng dữ liệu

| Bảng | Cột chính | Ghi chú |
| --- | --- | --- |
| `restaurants` | `id`, `name`, `sort_order` | Mỗi dòng là 1 menu (quán). `name` unique. |
| `dishes` | `id`, `restaurant_id`, `name`, `image_url`, `is_available`, `is_new`, `sort_order`, `created_at` | `is_new` = nhãn NEW, món NEW luôn đứng đầu menu. |
| `orders` | `id`, `dish_id`, `dish_name`, `restaurant_name`, `person_name`, `person_id`, `order_date` | `dish_name`/`restaurant_name` là snapshot để đơn cũ không vỡ khi xóa món. `person_id` = định danh trình duyệt (đổi tên không phá đơn), `person_name` chỉ để hiển thị. |
| `reviews` | `id`, `dish_id`, `dish_name`, `person_name`, `rating`, `comment` | `rating` 1–5, comment tối đa 300 ký tự. |
| `chat_messages` | `id`, `person_name`, `message` | Tối đa 300 ký tự/tin. |

Bucket storage: `dish-images` (public, ảnh món).

## 4. Nâng cấp schema (database đã tồn tại)

`schema.sql` gom cả phần `CREATE` lẫn các khối `MIGRATION:` ở cuối file. Cách đơn giản
nhất là chạy lại toàn bộ file — các khối đều idempotent.

| Khối trong `schema.sql` | Khi nào cần chạy |
| --- | --- |
| Phần bảng chính (đầu file) | Lần đầu tạo database |
| `MIGRATION: Đánh giá món` | Bảng `reviews` chưa có (bản cũ trước tính năng đánh giá) |
| `MIGRATION: Chat nội bộ` | Bảng `chat_messages` chưa có |
| `MIGRATION: Nhãn NEW cho món mới` | Cột `dishes.is_new` chưa có / index `dishes_new_idx` cần thêm |
| `MIGRATION: Định danh người đặt (person_id)` | Cột `orders.person_id` chưa có / index `orders_person_idx` cần thêm |

Khối NEW:

```sql
alter table public.dishes
  add column if not exists is_new boolean not null default false;

create index if not exists dishes_new_idx
  on public.dishes (restaurant_id, is_new desc, sort_order);
```

> **Thứ tự deploy:** chạy SQL **trước** khi đẩy code mới. Code mới `select("... is_new")`
> hoặc `person_id` sẽ lỗi PostgREST `42703 column ... does not exist` nếu cột chưa tồn tại.
> Nếu lỡ deploy code trước: chạy khối migration rồi `Ctrl+F5` trên trình duyệt.

Phần realtime đã được bọc `do $$ ... $$` nên không còn lỗi
`42710: relation ... is already member of publication` khi chạy lần hai.

## 5. Thời tiết & gợi ý món

Panel thời tiết dùng **Open-Meteo** (miễn phí, không cần key, không cần đăng ký) — không phải
cấu hình gì thêm. Toạ độ TP.HCM đã đặt sẵn trong `js/config.js`:
`WEATHER_LAT`, `WEATHER_LON`, `WEATHER_CITY`, `WEATHER_TZ`.

Gợi ý món chạy **hoàn toàn phía trình duyệt** bằng luật từ khoá trong `js/weather.js`
(`COOL_KEYWORDS` cho mưa/mát, `HOT_KEYWORDS` cho nóng/nóng ẩm). Không có server, không có
API key, không tốn phí. Muốn chỉnh gợi ý thì sửa 2 mảng từ khoá đó (viết không dấu, chữ thường).
