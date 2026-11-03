# Plan: Gắn đơn đặt cơm cho đúng người khi đổi tên

## Vấn đề

Hiện "danh tính" người đặt chỉ là **tên gõ tay** (`localStorage.dedatcom_person` → cột `orders.person_name`).
Đổi tên giữa ngày phá danh sách theo 3 cách đã kiểm chứng trong code:

| # | Kịch bản | Hành vi hiện tại | Vị trí |
| --- | --- | --- | --- |
| 1 | An đặt 1 món, đổi tên thành "An2", bấm + món khác | Không thấy đơn cũ → **tạo đơn thứ 2** (An có 2 suất) | `myTodayOrders()` lọc `person_name === state.person`, `js/app.js:503` |
| 2 | An đặt, đổi tên An2, đặt tiếp, rồi đổi lại "An" | Có 2 đơn của An → đổi món sẽ **xoá cả 2** rồi tạo 1 | `placeOrder()` `delete().eq("person_name", state.person)`, `js/app.js:547`; `addOrder()` chỉ xử lý `mine[0]` |
| 3 | Hai người cùng tên "An" | Chung 1 slot, người sau đè/xoá đơn người trước | Cùng cơ chế lọc theo tên |
| 4 | Gõ tên lệch ("An" ↔ "an" ↔ "An ") | Sinh đơn trùng lặp; copy list bị 2 dòng khác nhau | `el.nameInput.value.trim()` (`js/app.js:207`), không chuẩn hoá hoa/thường |

Gốc rễ: **khoá định danh là chuỗi tên**, mà tên do người dùng đổi được bất cứ lúc nào. Đổi tên không phá gì về dữ liệu, nhưng *mọi* so khớp để xác định "đơn của tôi" đều sai.

## Quyết định thiết kế

**Định danh thiết bị (device id) là nguồn sự thật cho quyền sở hữu đơn; tên chỉ còn là nhãn hiển thị.**

- Cột mới `orders.person_id uuid` — id ngẫu nhiên sinh 1 lần trên mỗi trình duyệt, lưu `localStorage.dedatcom_person_id`.
- "Đơn của tôi hôm nay" = `person_id === state.personId` (ưu tiên) **hoặc** thuộc `dedatcom_orders` (ids của máy này).
- Tên vẫn lưu vào `person_name` để copy list / hiển thị — nhưng **đổi tên không còn ảnh hưởng** tới logic sở hữu.
- Không cần đăng nhập, không phá mô hình "chỉ chia sẻ nội bộ".

Vì sao không dùng tên đã chuẩn hoá (lowercase + bỏ dấu cách) làm khoá: vẫn không giải quyết (1) và (2) — đổi tên thật vẫn sinh danh tính mới — và vẫn để hai người cùng tên chung slot.

## Thay đổi

### 1. `supabase/schema.sql`

a) Bảng `orders` (dòng ~29–38) thêm cột:

```sql
person_id uuid,
```

(Cho phép NULL để tương thích đơn cũ / client chưa reload.)

b) Thêm khối migration cuối file, cạnh các khối `MIGRATION:` khác (sau khối Nhãn NEW):

```sql
-- =============================================================
-- MIGRATION: Định danh người đặt (person_id)
-- Chạy phần này nếu database đã tồn tại từ phiên bản trước.
-- Chạy lại nhiều lần vẫn an toàn.
-- =============================================================

alter table public.orders
  add column if not exists person_id uuid;

create index if not exists orders_person_idx
  on public.orders (order_date, person_id);
```

Không cần policy mới (policy `orders insert` đã `with check (true)`).

Migration của tính năng NEW (`is_new`) **vẫn phải chạy trước** — nếu chưa chạy thì trang đã lỗi từ trước, không liên quan plan này.

### 2. `js/app.js` — hằng số & danh tính

a) Thêm key mới cạnh `KEY_PERSON`/`KEY_ORDERS` (dòng 5–6):

```js
const KEY_PERSON_ID = "dedatcom_person_id";
```

b) Thêm `personId: ""` vào `state` (dòng ~10).

c) Helper mới, đặt trong mục `/* Person */` trước `setPerson`:

```js
function ensurePersonId() {
  let id = "";
  try {
    id = localStorage.getItem(KEY_PERSON_ID) || "";
  } catch {
    id = "";
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(KEY_PERSON_ID, id);
    } catch {
      /* chế độ riêng tư chặn storage: vẫn dùng id trong RAM cho session này */
    }
  }
  state.personId = id;
  return id;
}
```

d) `myTodayOrders()` (`js/app.js:503`) — đổi sang khớp theo người, không theo tên:

```js
function myTodayOrders() {
  if (!state.person && !state.personId) return [];
  const localIds = readLocalOrders();
  return state.orders.filter(
    (o) =>
      (state.personId && o.person_id === state.personId) ||
      (o.id && localIds.includes(o.id))
  );
}
```

Giữ nhánh `localIds` để đơn cũ (chưa có `person_id`) vẫn được nhận đúng trên máy đã đặt.

e) Đổi tên người (`el.nameForm` submit, `js/app.js:205–215`) — khi tên đổi và máy này **đã có đơn hôm nay**, cập nhật luôn `person_name` trên DB để list không hiện tên cũ:

```js
el.nameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = el.nameInput.value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LEN);
  if (!name) {
    el.nameInput.focus();
    return;
  }
  const prevName = state.person;
  const isNew = name !== prevName;
  setPerson(name);
  if (!isNew || !state.supabase || !state.personId) return;

  const mine = myTodayOrders();
  if (mine.length) {
    const { error } = await state.supabase
      .from("orders")
      .update({ person_name: name })
      .eq("order_date", todayISO())
      .eq("person_id", state.personId);
    if (error) {
      toast("Đã đổi tên, nhưng chưa cập nhật được đơn cũ: " + error.message, "error");
      return;
    }
    mine.forEach((o) => {
      o.person_name = name;
    });
    renderOrders();
    refreshMineUI();
  }
  toast(`Xin chào ${name}!`, "success");
});
```

Chuẩn hoá khoảng trắng (`replace(/\s+/g, " ")`) khi nhập tên: "An  Pham" → "An Pham". (Không hạ chữ thường — "An" và "an" vẫn là 2 nhãn khác nhau nhưng **không còn tạo đơn trùng** vì sở hữu tính theo `person_id`.)

f) `placeOrder()` (`js/app.js:527–600`):

- Insert thêm `person_id: state.personId || null` (cả object insert và object `saved` fallback dòng ~572–580 dùng chung giá trị).
- Nhánh `replace` (dòng ~547–557): thay `delete().eq("person_name", state.person)` bằng xoá **theo id** những đơn của tôi, tránh xoá nhầm đơn người khác trùng tên và tránh xoá nhiều hơn 1 đơn:

```js
if (replace && mine.length) {
  const mineIds = mine.map((o) => o.id);
  const { error: delError } = await state.supabase
    .from("orders")
    .delete()
    .in("id", mineIds);
  if (delError) throw delError;

  const removedIds = new Set(mineIds);
  state.orders = state.orders.filter((o) => !removedIds.has(o.id));
  saveLocalOrders(readLocalOrders().filter((id) => !removedIds.has(id)));
}
```

- `select(...)` sau insert: thêm `person_id`.

g) `addOrder()` (`js/app.js:602+`) — thay `mine[0]` bằng "đơn mới nhất của tôi" để đúng khi có dữ liệu cũ nhiều đơn:

```js
const current = mine.slice().sort((a, b) =>
  String(b.created_at || "").localeCompare(String(a.created_at || ""))
)[0];
```

Dùng `current` ở mọi chỗ sau đó (thông báo + `placeOrder(..., { replace: true })`).

h) `loadOrders()` select (dòng ~274) — thêm `person_id`.

i) Realtime handler `INSERT` trên `orders` (dòng ~1508) — không cần đổi (dòng mới có đủ cột), nhưng nếu đơn của chính máy này về qua realtime trước khi `placeOrder()` push vào `state.orders` thì việc khử trùng đã có (`state.orders.some(...)`).

j) `init()` (`js/app.js:1627`) — gọi `ensurePersonId()` **trước** `setPerson(savedPerson)`:

```js
ensurePersonId();
const savedPerson = (localStorage.getItem(KEY_PERSON) || "").trim();
setPerson(savedPerson);
```

### 3. `js/app.js` — hiển thị đơn của tôi

- `renderOrders()` (`js/app.js:1426`) đang dùng `isMine(o.id)` (chỉ dựa localStorage). Đổi helper `isMine` thành:

```js
function isMine(order) {
  if (typeof order === "string") return readLocalOrders().includes(order);
  if (!order) return false;
  if (state.personId && order.person_id === state.personId) return true;
  return Boolean(order.id) && readLocalOrders().includes(order.id);
}
```

  và gọi `isMine(o)` thay vì `isMine(o.id)`.

- `refreshMineUI()` / `renderMyPickBar()` không cần sửa — chúng dùng `myTodayOrders()`.

### 4. `index.html` — làm rõ hành vi đổi tên

Mô tả trong `#nameModal` (dòng ~132) đổi thành nội dung nêu rõ: *"Đổi tên chỉ đổi cách hiển thị trên đơn của bạn — món bạn đã chọn được giữ nguyên."* (giữ câu "Không cần tài khoản").

### 5. Docs

- `docs/su-dung.md`: thêm bullet trong mục "Trang đặt cơm": đổi tên không làm mất/không nhân bản đơn; đơn gắn với **trình duyệt** (dùng chung máy hoặc xoá dữ liệu trình duyệt thì mất liên kết, có thể xoá tay đơn trên list).
- `docs/xu-ly-su-co.md`: thêm dòng "Xoá dữ liệu trang (localStorage) → trang coi bạn là người mới; đơn cũ vẫn nằm trong danh sách, xoá tay bằng ✕ nếu đặt lại" và dòng `column orders.person_id does not exist` (42703) → chạy khối `MIGRATION: Định danh người đặt`.
- `docs/cai-dat.md`: bảng dữ liệu bảng `orders` thêm `person_id`; bảng "Khi nào cần chạy" thêm khối migration mới.

## Thứ tự thực hiện

1. `supabase/schema.sql`: thêm cột + index + khối migration → **chạy trên Supabase trước khi deploy code**.
2. `js/app.js`: `KEY_PERSON_ID`, `state.personId`, `ensurePersonId()`, `myTodayOrders()`, `isMine()`, `loadOrders()` select, insert/select `person_id`, nhánh `replace` xoá theo id, `addOrder()` chọn đơn mới nhất, handler đổi tên cập nhật `person_name`, `init()` gọi `ensurePersonId()`.
3. `index.html`: text modal tên.
4. Docs 3 file.

## Rủi ro & lưu ý

| Rủi ro | Xử lý |
| --- | --- |
| Deploy code trước SQL → `42703 column orders.person_id does not exist` | Chạy migration trước; nếu lỡ: chạy khối migration rồi Ctrl+F5 |
| Đơn cũ chưa có `person_id` (trước khi deploy) | Vẫn nhận đúng nhờ nhánh `readLocalOrders()` trong `myTodayOrders()`/`isMine()` |
| Người dùng xoá localStorage / đổi máy | Mất liên kết đơn — ghi rõ trong docs; xoá tay đơn trên list (đã có) hoặc dùng nút đổi món (vẫn hỏi confirm) |
| Chế độ riêng tư chặn localStorage | `ensurePersonId()` vẫn sinh id trong RAM; đơn gắn đúng trong phiên đó; tải lại trang → id mới (chấp nhận, hiện trạng tương tự với tên) |
| Xung đột với tính năng "AI gợi ý"/vòng quay | `placeOrder` giữ nguyên `findDishAnywhere`/`findRestaurantFor`; chỉ đổi nguồn `mine` và payload |
| Hai người cùng tên vẫn hiện 2 dòng giống nhau trong list copy | Không sửa ở đây (tên là nhãn hiển thị); nếu cần phân biệt thì là việc riêng, ngoài phạm vi |
| `replace` chỉ xoá đơn của người đó | Đã đổi sang `.in("id", mineIds)` — không xoá đơn người khác trùng tên |

## Validation

- [ ] `node --check js/app.js` pass; import thử với DOM giả (`smoke2.mjs`) không crash.
- [ ] Không còn `eq("person_name", ...)` trong `js/app.js` (grep).
- [ ] Thủ công: đặt món → đổi tên (chip tên) → bấm **+** món khác → hiện hộp "Bạn đã chọn món rồi", YES → **chỉ còn 1 đơn**, tên mới, món mới.
- [ ] Thủ công: đặt món → đổi tên → mở list → dòng đơn hiển thị tên mới (kể cả trên máy khác).
- [ ] Thủ công: đổi tên về lại tên cũ → vẫn chỉ 1 đơn, không sinh đơn thứ 2.
- [ ] Thủ công: 2 trình duyệt cùng nhập tên "An" → mỗi bên 1 đơn riêng; đổi món bên này không xoá đơn bên kia.
- [ ] Thủ công: đơn cũ tạo trước migration (không có `person_id`) → máy đã đặt vẫn thấy nút ✓ và không đặt thêm được khi bấm +.
- [ ] Đăng nhập chế độ riêng tư: đặt được, tải lại trang → vào lại tên, đặt món khác → có confirm đổi (không tạo 2 đơn).

## Ngoài phạm vi

- Đăng nhập / tài khoản thật.
- Ghép hai đơn khác nhau (An + An2) thành một tự động khi người dùng đổi tên nhiều lần bằng tay + tải lại trang cũ.
- Đồng bộ `person_id` giữa nhiều máy của cùng một người.
- Chuẩn hoá hoa/thường của `person_name` trong dữ liệu cũ.
