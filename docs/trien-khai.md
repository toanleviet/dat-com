[← Về README](../README.md)

# Deploy

Đây là site tĩnh, deploy được ở bất kỳ static hosting nào.

## GitHub Pages

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

## Netlify

Kéo thả thư mục `D:\DatCom` vào <https://app.netlify.com/drop>. Không cần
build command. (Nhớ đã điền `js/config.js` trước khi deploy.)

## Trước khi deploy

1. Chạy `supabase/schema.sql` (và các khối `MIGRATION:` nếu database đã có) —
   **trước** khi đẩy code mới. Thiếu cột `dish.is_new` → trang lỗi
   `column dishes.is_new does not exist`.
2. `js/config.js` có đủ `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

> anon key nằm trong file public là **bình thường** với Supabase — nó không
> phải secret, bảo mật do RLS quyết định.

## Cấu trúc file

```
index.html                    trang đặt cơm
setup.html                    trang quản lý món + xóa dữ liệu
css/style.css
js/config.js                  SUPABASE_URL, SUPABASE_ANON_KEY (điền tay)
js/supabase-client.js         khởi tạo client
js/app.js                     đặt cơm + list realtime + copy + vòng quay + đánh giá
js/setup.js                   CRUD món + upload ảnh + import CSV + xóa dữ liệu
js/placeholder.js             sinh ảnh placeholder từ tên món
supabase/schema.sql           bảng + RLS + bucket + realtime + seed + migrations
supabase/mau-import-mon.csv   file CSV mẫu để tham khảo format
docs/                         tài liệu chi tiết
README.md
```

Thư viện `@supabase/supabase-js` tải qua ESM CDN (`https://esm.sh/@supabase/supabase-js@2`),
không cần `npm install`.
