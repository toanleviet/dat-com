[← Về README](../README.md)

# Import món từ CSV

File CSV **2 cột**, dòng đầu là header:

```csv
restaurant,name
Hải Nam,Cơm sườn
Hải Nam,Cơm gà nướng
Dejavu,Cơm bò lúc lắc
```

| Quy tắc | Chi tiết |
| --- | --- |
| Header | `restaurant,name` (chấp nhận cả `quan,mon`, `Restaurant,Dish`) |
| Phân cách | `,` hoặc `;` (Excel Việt Nam) hoặc tab — tự nhận diện |
| Mã hoá | UTF-8. Excel: **Save As → CSV UTF-8** |
| Tên quán | Phải khớp tên trong bảng `restaurants` (không phân biệt hoa thường, thừa dấu cách) |
| Tên món | Tối đa 80 ký tự. Có dấu phẩy thì bọc `"..."` |
| Thứ tự | Tự đánh nối tiếp sau món cuối của quán đó |
| Trùng | Món đã có trong quán → **bỏ qua**, không tạo trùng |
| Nhãn NEW | Món import mặc định `is_new = false` (bật tay ở trang Setup nếu cần) |
| Giới hạn | 1MB, 500 dòng/lần |

File mẫu: [`supabase/mau-import-mon.csv`](../supabase/mau-import-mon.csv).

**Luồng trên web:** chọn file → **xem trước** (danh sách món, dòng nào trùng/lỗi)
→ bấm **Nhập N món**. Không ghi vào database cho tới khi bạn xác nhận.

## Mẹo tạo file nhanh

- Từ Excel: nhập 2 cột, **Save As → CSV UTF-8** (đừng chọn "CSV (Comma delimited)" của
  hệ thống cũ vì có thể sai font tiếng Việt).
- Từ ảnh thực đơn: nhờ AI chuyển thành bảng `restaurant,name` rồi lưu thành `.csv`.
- Tên quán trong file phải trùng với quán đã có ở trang Setup; muốn thêm quán mới thì
  thêm quán trước (hiện chưa có form thêm quán trên web — thêm trực tiếp trong bảng
  `restaurants` qua Supabase Dashboard).
