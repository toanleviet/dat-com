import { isConfigured, IMAGE_BUCKET, MAX_IMAGE_SIZE } from "./config.js";
import { getSupabase } from "./supabase-client.js";
import { attachDishImage } from "./placeholder.js";

const state = {
  supabase: null,
  restaurants: [],
  dishes: [],
  editingId: null,
  pendingImageFile: null,
  currentImageUrl: null,
  csvRows: [],
  csvBusy: false,
};

const $ = (id) => document.getElementById(id);

const el = {
  configBanner: $("configBanner"),
  errorBanner: $("errorBanner"),
  errorMessage: $("errorMessage"),
  retryBtn: $("retryBtn"),
  formTitle: $("formTitle"),
  dishForm: $("dishForm"),
  dishName: $("dishName"),
  dishRestaurant: $("dishRestaurant"),
  dishSort: $("dishSort"),
  dishIsNew: $("dishIsNew"),
  dishImage: $("dishImage"),
  previewThumb: $("previewThumb"),
  previewHint: $("previewHint"),
  submitBtn: $("submitBtn"),
  cancelEditBtn: $("cancelEditBtn"),
  totalCount: $("totalCount"),
  dishManageArea: $("dishManageArea"),
  purgeBtn: $("purgeBtn"),
  toastWrap: $("toastWrap"),
  csvFile: $("csvFile"),
  csvPreview: $("csvPreview"),
  csvSummary: $("csvSummary"),
  csvRows: $("csvRows"),
  csvImportBtn: $("csvImportBtn"),
  csvClearBtn: $("csvClearBtn"),
  csvEmpty: $("csvEmpty"),
  csvCount: $("csvCount"),
};

/* ---------------- Helpers ---------------- */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function toast(message, type = "") {
  const node = document.createElement("div");
  node.className = "toast" + (type ? " " + type : "");
  node.textContent = message;
  el.toastWrap.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function showError(title, message) {
  el.errorBanner.classList.remove("hidden");
  el.errorBanner.querySelector("#errorTitle").textContent = title;
  el.errorMessage.textContent = message || "";
}

function hideError() {
  el.errorBanner.classList.add("hidden");
}

function fileExt(file) {
  const fromName = (file.name.split(".").pop() || "").toLowerCase();
  const safe = /^(jpe?g|png|webp|gif|avif)$/.test(fromName);
  if (safe) return fromName === "jpeg" ? "jpg" : fromName;
  const fromType = (file.type.split("/").pop() || "").toLowerCase();
  return fromType === "jpeg" ? "jpg" : fromType || "jpg";
}

/* ---------------- Data ---------------- */

async function loadRestaurants() {
  const { data, error } = await state.supabase
    .from("restaurants")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  state.restaurants = data || [];
  renderRestaurantOptions();
}

function renderRestaurantOptions() {
  const prev = el.dishRestaurant.value;
  el.dishRestaurant.innerHTML = state.restaurants
    .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`)
    .join("");
  if (prev && state.restaurants.some((r) => r.id === prev)) el.dishRestaurant.value = prev;
  if (!state.restaurants.length) {
    el.dishRestaurant.innerHTML = '<option value="">(chưa có quán)</option>';
  }
}

async function loadDishes() {
  const { data, error } = await state.supabase
    .from("dishes")
    .select("id, restaurant_id, name, image_url, is_available, is_new, sort_order, created_at")
    .order("is_new", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  state.dishes = data || [];
  renderDishList();
}

/** Món NEW luôn đứng đầu, rồi tới sort_order, rồi created_at. */
function sortDishes(list) {
  return list.slice().sort((a, b) => {
    if (Boolean(a.is_new) !== Boolean(b.is_new)) return a.is_new ? -1 : 1;
    const sa = a.sort_order ?? 0;
    const sb = b.sort_order ?? 0;
    if (sa !== sb) return sa - sb;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

/* ---------------- Render list ---------------- */

function renderDishList() {
  el.totalCount.textContent = `${state.dishes.length} món`;

  if (!state.dishes.length) {
    el.dishManageArea.innerHTML =
      '<div class="empty-state">Chưa có món nào. Dùng form bên cạnh để thêm.</div>';
    return;
  }

  const groups = state.restaurants
    .map((r) => ({
      restaurant: r,
      dishes: sortDishes(state.dishes.filter((d) => d.restaurant_id === r.id)),
    }))
    .filter((g) => g.dishes.length);

  const orphaned = sortDishes(
    state.dishes.filter((d) => !state.restaurants.some((r) => r.id === d.restaurant_id))
  );
  if (orphaned.length) groups.push({ restaurant: { name: "Khác" }, dishes: orphaned });

  el.dishManageArea.innerHTML = groups
    .map(
      (g) => `
      <h3 style="margin:14px 0 4px">${escapeHtml(g.restaurant.name)}</h3>
      ${g.dishes
        .map(
          (d) => `
        <div class="setup-dish${d.is_available ? "" : " unavailable"}" data-id="${escapeHtml(d.id)}">
          <div class="thumb">
            <img alt="${escapeHtml(d.name)}" />
            <div class="placeholder"></div>
          </div>
          <div class="info">
            <div class="title">${escapeHtml(d.name)}${d.is_new ? '<span class="mini-new">NEW</span>' : ""}</div>
            <div class="sub">
              #${d.sort_order} · ${d.is_available ? "Đang bán" : "Tạm ẩn"}
            </div>
          </div>
          <div class="actions">
            <button type="button" class="btn btn-sm" data-edit="${escapeHtml(d.id)}">Sửa</button>
            <button type="button" class="btn btn-sm" data-toggle="${escapeHtml(d.id)}">
              ${d.is_available ? "Ẩn" : "Bật"}
            </button>
            <button type="button" class="btn btn-sm btn-danger" data-delete="${escapeHtml(d.id)}">Xóa</button>
          </div>
        </div>`
        )
        .join("")}`
    )
    .join("");

  el.dishManageArea.querySelectorAll(".setup-dish").forEach((row) => {
    const dish = state.dishes.find((d) => d.id === row.dataset.id);
    if (dish) attachDishImage(row.querySelector(".thumb"), dish.image_url, dish.name);
  });

  el.dishManageArea.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => startEdit(btn.dataset.edit))
  );
  el.dishManageArea.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => toggleDish(btn.dataset.toggle))
  );
  el.dishManageArea.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => deleteDish(btn.dataset.delete))
  );
}

/* ---------------- Preview ---------------- */

function renderPreview(name, imageUrl) {
  attachDishImage(el.previewThumb, imageUrl, name || "Món");
}

el.previewThumb.querySelector("img").addEventListener("error", () => {
  if (state.editingId) state.currentImageUrl = null;
});

function updateLocalPreview() {
  const file = el.dishImage.files && el.dishImage.files[0];
  if (file) {
    el.previewHint.textContent = `Ảnh mới: ${file.name}`;
    renderPreview(el.dishName.value || file.name, URL.createObjectURL(file));
  } else if (state.editingId) {
    el.previewHint.textContent = state.currentImageUrl
      ? "Đang giữ ảnh hiện tại (chọn ảnh khác để thay)."
      : "Món này chưa có ảnh — sẽ dùng placeholder.";
    renderPreview(el.dishName.value, state.currentImageUrl);
  } else {
    el.previewHint.textContent = "Bỏ trống ảnh để dùng placeholder theo tên món.";
    renderPreview(el.dishName.value, "");
  }
}

el.dishImage.addEventListener("change", () => {
  state.pendingImageFile = el.dishImage.files && el.dishImage.files[0] ? el.dishImage.files[0] : null;
  updateLocalPreview();
});

el.dishName.addEventListener("input", () => {
  if (!state.pendingImageFile) {
    updateLocalPreview();
  } else {
    renderPreview(el.dishName.value, el.previewThumb.querySelector("img").getAttribute("src"));
  }
});

/* ---------------- Edit mode ---------------- */

function resetForm() {
  state.editingId = null;
  state.pendingImageFile = null;
  state.currentImageUrl = null;
  el.dishForm.reset();
  el.dishSort.value = "0";
  if (el.dishIsNew) el.dishIsNew.checked = false;
  el.formTitle.textContent = "Thêm món mới";
  el.submitBtn.textContent = "Thêm món";
  el.cancelEditBtn.classList.add("hidden");
  renderRestaurantOptions();
  updateLocalPreview();
}

function startEdit(id) {
  const dish = state.dishes.find((d) => d.id === id);
  if (!dish) return;
  state.editingId = id;
  state.pendingImageFile = null;
  state.currentImageUrl = dish.image_url || null;
  el.dishName.value = dish.name;
  el.dishRestaurant.value = dish.restaurant_id;
  el.dishSort.value = String(dish.sort_order ?? 0);
  if (el.dishIsNew) el.dishIsNew.checked = Boolean(dish.is_new);
  el.dishImage.value = "";
  el.formTitle.textContent = "Sửa món";
  el.submitBtn.textContent = "Lưu thay đổi";
  el.cancelEditBtn.classList.remove("hidden");
  updateLocalPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
  el.dishName.focus();
}

el.cancelEditBtn.addEventListener("click", () => resetForm());

/* ---------------- Upload ---------------- */

async function uploadImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("File không phải ảnh.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Ảnh vượt quá 2MB.");

  const ext = fileExt(file);
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await state.supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = state.supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function removeOldImage(url) {
  if (!url) return;
  const marker = `/${IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length).split("?")[0];
  if (!path) return;
  await state.supabase.storage.from(IMAGE_BUCKET).remove([path]).catch(() => {});
}

/* ---------------- Submit ---------------- */

el.dishForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (el.dishForm.dataset.busy === "1") return;

  const name = el.dishName.value.trim();
  const restaurantId = el.dishRestaurant.value;
  const sortOrder = Number.parseInt(el.dishSort.value, 10) || 0;
  const isNew = Boolean(el.dishIsNew && el.dishIsNew.checked);

  if (!name) return el.dishName.focus();
  if (!restaurantId) return toast("Chưa có quán nào để gán món.", "error");

  el.dishForm.dataset.busy = "1";
  el.submitBtn.disabled = true;
  const originalLabel = el.submitBtn.textContent;
  el.submitBtn.textContent = state.editingId ? "Đang lưu..." : "Đang thêm...";

  try {
    let imageUrl = state.editingId ? state.currentImageUrl : null;
    const file = el.dishImage.files && el.dishImage.files[0];

    if (file) {
      imageUrl = await uploadImage(file);
      if (state.editingId && state.currentImageUrl && state.currentImageUrl !== imageUrl) {
        await removeOldImage(state.currentImageUrl);
      }
    }

    if (state.editingId) {
      const { error } = await state.supabase
        .from("dishes")
        .update({
          name,
          restaurant_id: restaurantId,
          sort_order: sortOrder,
          image_url: imageUrl,
          is_new: isNew,
        })
        .eq("id", state.editingId);
      if (error) throw error;
      toast("Đã lưu thay đổi.", "success");
    } else {
      const { error } = await state.supabase
        .from("dishes")
        .insert({
          name,
          restaurant_id: restaurantId,
          sort_order: sortOrder,
          image_url: imageUrl,
          is_new: isNew,
        });
      if (error) throw error;
      toast("Đã thêm món.", "success");
    }

    resetForm();
    await loadDishes();
  } catch (err) {
    toast("Lỗi: " + (err.message || String(err)), "error");
  } finally {
    delete el.dishForm.dataset.busy;
    el.submitBtn.disabled = false;
    el.submitBtn.textContent = state.editingId ? "Lưu thay đổi" : originalLabel;
  }
});

/* ---------------- Row actions ---------------- */

async function toggleDish(id) {
  const dish = state.dishes.find((d) => d.id === id);
  if (!dish) return;
  const { error } = await state.supabase
    .from("dishes")
    .update({ is_available: !dish.is_available })
    .eq("id", id);
  if (error) return toast("Lỗi: " + error.message, "error");
  await loadDishes();
}

async function deleteDish(id) {
  const dish = state.dishes.find((d) => d.id === id);
  if (!dish) return;
  const ok = window.confirm(
    `Xóa món "${dish.name}"?\n\nCác đơn đã đặt vẫn giữ tên món (lưu snapshot), chỉ món không còn trong menu.`
  );
  if (!ok) return;

  const { error } = await state.supabase.from("dishes").delete().eq("id", id);
  if (error) return toast("Lỗi: " + error.message, "error");

  if (dish.image_url) await removeOldImage(dish.image_url);
  if (state.editingId === id) resetForm();
  toast("Đã xóa món.", "success");
  await loadDishes();
}

/* ---------------- Import CSV ---------------- */

const CSV_MAX_BYTES = 1024 * 1024;
const CSV_MAX_ROWS = 500;
const DISH_NAME_MAX = 80;

/**
 * Bộ đọc CSV theo RFC 4180: hỗ trợ bọc ngoặc kép, "" để escape, xuống dòng trong ô.
 * Tự nhận diện dấu phân cách (dấu phẩy / chấm phẩy / tab) trên dòng đầu.
 */
function parseCsv(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");

  const firstLine = src.split(/\r?\n/)[0] || "";
  const delimiter = [";", "\t", ","].reduce((best, d) => {
    const count = firstLine.split(d).length - 1;
    return count > (firstLine.split(best).length - 1) ? d : best;
  }, ",");

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"' && field.trim() === "") {
      inQuotes = true;
      field = "";
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return { rows, delimiter };
}

function normHeader(str) {
  return String(str || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const HEADER_ALIASES = {
  restaurant: ["restaurant", "restaurants", "quan", "ten quan", "menu", "cua hang"],
  name: ["name", "dish", "dish_name", "mon", "ten mon", "ten"],
};

function matchColumn(headerCell) {
  const h = normHeader(headerCell).replace(/\s+/g, " ");
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return key;
  }
  return null;
}

function buildRestaurantLookup() {
  const map = new Map();
  for (const r of state.restaurants) {
    map.set(normHeader(r.name).replace(/\s+/g, " "), r);
  }
  return map;
}

function existingDishKeys() {
  const set = new Set();
  const byId = new Map(state.restaurants.map((r) => [r.id, r]));
  for (const d of state.dishes) {
    const r = byId.get(d.restaurant_id);
    const rkey = r ? normHeader(r.name) : "";
    set.add(rkey + "\u0000" + normHeader(d.name).replace(/\s+/g, " "));
  }
  return set;
}

function analyzeCsv(text) {
  const { rows, delimiter } = parseCsv(text);
  const errors = [];
  const result = {
    delimiter,
    rows: [],
    validCount: 0,
    duplicateCount: 0,
    errorCount: 0,
  };

  if (!rows.length) {
    errors.push("File trống.");
    return { ...result, errors };
  }

  const header = rows[0];
  const colIndex = { restaurant: -1, name: -1 };
  header.forEach((cell, idx) => {
    const key = matchColumn(cell);
    if (key && colIndex[key] === -1) colIndex[key] = idx;
  });

  if (colIndex.restaurant === -1 || colIndex.name === -1) {
    errors.push(
      `Dòng đầu phải là header có 2 cột "restaurant" và "name" (tìm thấy: ${
        header.map((h) => `"${h.trim()}"`).join(", ") || "trống"
      }).`
    );
    return { ...result, errors };
  }

  const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
  if (!dataRows.length) {
    errors.push("Header đúng nhưng không có dòng dữ liệu nào.");
    return { ...result, errors };
  }
  if (dataRows.length > CSV_MAX_ROWS) {
    errors.push(`File có ${dataRows.length} dòng, vượt giới hạn ${CSV_MAX_ROWS} dòng/lần.`);
    return { ...result, errors };
  }

  const restaurantMap = buildRestaurantLookup();
  const seenKeys = existingDishKeys();
  const nextSort = new Map();
  for (const r of state.restaurants) {
    const max = state.dishes
      .filter((d) => d.restaurant_id === r.id)
      .reduce((m, d) => Math.max(m, d.sort_order || 0), 0);
    nextSort.set(r.id, max);
  }
  const queuedSort = new Map();

  dataRows.forEach((cells, i) => {
    const lineNo = i + 2;
    const rawRestaurant = String(cells[colIndex.restaurant] ?? "").trim();
    const rawName = String(cells[colIndex.name] ?? "").trim().replace(/\s+/g, " ");

    const item = {
      lineNo,
      restaurantName: rawRestaurant,
      name: rawName,
      status: "ok",
      message: "",
      restaurantId: null,
      sortOrder: 0,
    };

    if (!rawRestaurant) {
      item.status = "error";
      item.message = "Thiếu tên quán";
    } else if (!rawName) {
      item.status = "error";
      item.message = "Thiếu tên món";
    } else if (rawName.length > DISH_NAME_MAX) {
      item.status = "error";
      item.message = `Tên món dài hơn ${DISH_NAME_MAX} ký tự`;
    } else {
      const r = restaurantMap.get(normHeader(rawRestaurant).replace(/\s+/g, " "));
      if (!r) {
        item.status = "error";
        item.message = `Không có quán "${rawRestaurant}"`;
      } else {
        item.restaurantId = r.id;
        const key = normHeader(r.name) + "\u0000" + normHeader(rawName).replace(/\s+/g, " ");
        if (seenKeys.has(key)) {
          item.status = "duplicate";
          item.message = "Đã có món này trong quán";
        } else {
          seenKeys.add(key);
          const base = nextSort.get(r.id) || 0;
          const offset = (queuedSort.get(r.id) || 0) + 1;
          queuedSort.set(r.id, offset);
          item.sortOrder = base + offset;
          item.status = "ok";
        }
      }
    }

    if (item.status === "ok") result.validCount++;
    else if (item.status === "duplicate") result.duplicateCount++;
    else result.errorCount++;

    result.rows.push(item);
  });

  return { ...result, errors };
}

function renderCsvPreview() {
  const rows = state.csvRows;
  const valid = rows.filter((r) => r.status === "ok");

  if (el.csvCount) el.csvCount.textContent = rows.length ? `${valid.length} món mới` : "";
  if (el.csvEmpty) el.csvEmpty.classList.add("hidden");
  if (el.csvPreview) el.csvPreview.classList.remove("hidden");

  const dups = rows.filter((r) => r.status === "duplicate").length;
  const errs = rows.filter((r) => r.status === "error").length;
  const parts = [`<b>${valid.length}</b> món sẽ được thêm`];
  if (dups) parts.push(`${dups} món trùng (bỏ qua)`);
  if (errs) parts.push(`<span class="csv-err">${errs} dòng lỗi</span>`);
  el.csvSummary.innerHTML = parts.join(" · ");

  const LABEL = {
    ok: "Sẽ thêm",
    duplicate: "Bỏ qua (trùng)",
    error: "Lỗi",
  };

  el.csvRows.innerHTML = rows
    .map(
      (r) => `
      <tr class="csv-row-${r.status}">
        <td class="csv-line">${r.lineNo}</td>
        <td>${escapeHtml(r.restaurantName || "—")}</td>
        <td>${escapeHtml(r.name || "—")}</td>
        <td>
          <span class="csv-status csv-${r.status}">${LABEL[r.status]}</span>
          ${r.message ? `<span class="csv-msg">${escapeHtml(r.message)}</span>` : ""}
        </td>
      </tr>`
    )
    .join("");

  el.csvImportBtn.disabled = valid.length === 0 || state.csvBusy;
  el.csvImportBtn.textContent = valid.length
    ? `Nhập ${valid.length} món`
    : "Không có món nào để nhập";
}

function resetCsvPreview() {
  state.csvRows = [];
  if (el.csvFile) el.csvFile.value = "";
  if (el.csvPreview) el.csvPreview.classList.add("hidden");
  if (el.csvEmpty) el.csvEmpty.classList.remove("hidden");
  if (el.csvCount) el.csvCount.textContent = "";
  if (el.csvRows) el.csvRows.innerHTML = "";
  if (el.csvSummary) el.csvSummary.innerHTML = "";
  if (el.csvImportBtn) {
    el.csvImportBtn.disabled = true;
    el.csvImportBtn.textContent = "Nhập 0 món";
  }
}

async function handleCsvFile(file) {
  if (!file) return;
  resetCsvPreview();

  if (file.size > CSV_MAX_BYTES) {
    toast("File lớn hơn 1MB — kiểm tra lại file CSV.", "error");
    return;
  }

  let text = "";
  try {
    const buf = await file.arrayBuffer();
    text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch (err) {
    toast("Không đọc được file: " + (err.message || String(err)), "error");
    return;
  }

  const analysis = analyzeCsv(text);

  if (analysis.errors && analysis.errors.length) {
    if (el.csvEmpty) el.csvEmpty.classList.add("hidden");
    if (el.csvPreview) el.csvPreview.classList.remove("hidden");
    el.csvSummary.innerHTML = `<span class="csv-err">${analysis.errors
      .map((e) => escapeHtml(e))
      .join("<br>")}</span>`;
    el.csvRows.innerHTML = "";
    el.csvImportBtn.disabled = true;
    el.csvImportBtn.textContent = "Không thể nhập";
    return;
  }

  state.csvRows = analysis.rows;
  renderCsvPreview();
}

async function importCsvRows() {
  if (state.csvBusy) return;
  const items = state.csvRows.filter((r) => r.status === "ok");
  if (!items.length) return;

  state.csvBusy = true;
  renderCsvPreview();
  el.csvImportBtn.textContent = "Đang nhập...";

  const payload = items.map((r) => ({
    restaurant_id: r.restaurantId,
    name: r.name,
    sort_order: r.sortOrder,
    image_url: null,
    is_available: true,
    is_new: false,
  }));

  try {
    const { error } = await state.supabase.from("dishes").insert(payload);
    if (error) throw error;
    toast(`Đã nhập ${payload.length} món.`, "success");
    resetCsvPreview();
    await loadDishes();
  } catch (err) {
    toast("Lỗi nhập CSV: " + (err.message || String(err)), "error");
    // Đánh dấu lại để người dùng thấy trạng thái thực tế
    await loadDishes().catch(() => {});
    state.csvRows = analyzeCsv(
      "restaurant,name\n" +
        items.map((r) => `"${r.restaurantName}","${r.name.replace(/"/g, '""')}"`).join("\n")
    ).rows || [];
    renderCsvPreview();
  } finally {
    state.csvBusy = false;
    if (!state.csvRows.length) {
      el.csvImportBtn.disabled = true;
      el.csvImportBtn.textContent = "Không có món nào để nhập";
    } else {
      renderCsvPreview();
    }
  }
}

if (el.csvFile) {
  el.csvFile.addEventListener("change", () => {
    const file = el.csvFile.files && el.csvFile.files[0];
    if (file) handleCsvFile(file);
  });
}

if (el.csvImportBtn) {
  el.csvImportBtn.addEventListener("click", () => importCsvRows());
}

if (el.csvClearBtn) {
  el.csvClearBtn.addEventListener("click", () => resetCsvPreview());
}

/* ---------------- Purge ---------------- */

el.purgeBtn.addEventListener("click", async () => {
  const ok1 = window.confirm("Xóa TOÀN BỘ đơn đã đặt? Thao tác này không khôi phục được.");
  if (!ok1) return;
  const ok2 = window.prompt('Gõ chính xác chữ XOA để xác nhận:');
  if (ok2 !== "XOA") {
    toast("Đã hủy — xác nhận không khớp.", "error");
    return;
  }

  el.purgeBtn.disabled = true;
  el.purgeBtn.textContent = "Đang xóa...";
  // PostgREST yêu cầu điều kiện filter; neq trên id khớp mọi dòng.
  const { error } = await state.supabase
    .from("orders")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  el.purgeBtn.disabled = false;
  el.purgeBtn.textContent = "Xóa toàn bộ đơn";

  if (error) return toast("Lỗi: " + error.message, "error");
  localStorage.removeItem("dedatcom_orders");
  toast("Đã xóa toàn bộ đơn.", "success");
});

/* ---------------- Boot ---------------- */

async function loadAll() {
  hideError();
  try {
    await loadRestaurants();
    await loadDishes();
  } catch (err) {
    showError("Không tải được dữ liệu.", err.message || String(err));
  }
}

el.retryBtn.addEventListener("click", () => loadAll());

async function init() {
  updateLocalPreview();

  if (!isConfigured()) {
    el.configBanner.classList.remove("hidden");
    el.dishManageArea.innerHTML =
      '<div class="empty-state">Chưa cấu hình Supabase — xem banner phía trên.</div>';
    return;
  }

  try {
    state.supabase = await getSupabase();
  } catch (err) {
    showError("Không tải được thư viện Supabase.", err.message || String(err));
    return;
  }

  await loadAll();

  state.supabase
    .channel("datcom-setup-dishes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dishes" },
      () => loadDishes()
    )
    .subscribe();
}

init();
