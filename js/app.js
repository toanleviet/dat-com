import { isConfigured } from "./config.js";
import { getSupabase } from "./supabase-client.js";
import { attachDishImage } from "./placeholder.js";

const KEY_PERSON = "dedatcom_person";
const KEY_ORDERS = "dedatcom_orders";
const MAX_NAME_LEN = 40;

const state = {
  person: "",
  supabase: null,
  restaurants: [],
  activeRestaurantId: null,
  dishes: [],
  orders: [],
  pendingDishIds: new Set(),
  loaded: false,
  realtimeChannel: null,
  reviews: [],
  reviewStats: new Map(),
  activeDish: null,
  selectedRating: 0,
  reviewBusy: false,
  allDishes: [],
};

const $ = (id) => document.getElementById(id);

const el = {
  personChip: $("personChip"),
  personChipName: $("personChipName"),
  configBanner: $("configBanner"),
  errorBanner: $("errorBanner"),
  errorMessage: $("errorMessage"),
  retryBtn: $("retryBtn"),
  todayLabel: $("todayLabel"),
  menuCards: $("menuCards"),
  dishSectionTitle: $("dishSectionTitle"),
  dishCount: $("dishCount"),
  dishArea: $("dishArea"),
  orderList: $("orderList"),
  orderEmpty: $("orderEmpty"),
  orderCount: $("orderCount"),
  copyBtn: $("copyBtn"),
  nameModal: $("nameModal"),
  nameForm: $("nameForm"),
  nameInput: $("nameInput"),
  nameModalTitle: $("nameModalTitle"),
  toastWrap: $("toastWrap"),
  reviewModal: $("reviewModal"),
  reviewCloseBtn: $("reviewCloseBtn"),
  reviewDishName: $("reviewDishName"),
  reviewSummary: $("reviewSummary"),
  reviewStarsInput: $("reviewStarsInput"),
  reviewComment: $("reviewComment"),
  reviewSubmitBtn: $("reviewSubmitBtn"),
  reviewHint: $("reviewHint"),
  reviewList: $("reviewList"),
  reviewEmpty: $("reviewEmpty"),
  myPickBar: $("myPickBar"),
  myPickText: $("myPickText"),
  confirmModal: $("confirmModal"),
  confirmTitle: $("confirmTitle"),
  confirmMessage: $("confirmMessage"),
  confirmYes: $("confirmYes"),
  confirmNo: $("confirmNo"),
  spinFab: $("spinFab"),
  spinModal: $("spinModal"),
  spinCloseBtn: $("spinCloseBtn"),
  spinWheelInner: $("spinWheelInner"),
  spinCanvas: $("spinCanvas"),
  spinGoBtn: $("spinGoBtn"),
  spinDishName: $("spinDishName"),
  spinResult: $("spinResult"),
  spinResultCard: $("spinResultCard"),
};

/* ---------------- Helpers ---------------- */

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatTodayLabel() {
  const d = new Date();
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function readLocalOrders() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(ids) {
  localStorage.setItem(KEY_ORDERS, JSON.stringify([...new Set(ids)]));
}

function addLocalOrder(id) {
  saveLocalOrders([...readLocalOrders(), id]);
}

function removeLocalOrder(id) {
  saveLocalOrders(readLocalOrders().filter((x) => x !== id));
}

function isMine(orderId) {
  return readLocalOrders().includes(orderId);
}

function orderLine(o) {
  return `${o.dish_name}_(${o.restaurant_name}) - ${o.person_name}`;
}

function toast(message, type = "") {
  const node = document.createElement("div");
  node.className = "toast" + (type ? " " + type : "");
  node.textContent = message;
  el.toastWrap.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function showError(title, message) {
  el.errorBanner.classList.remove("hidden");
  el.errorBanner.querySelector("#errorTitle").textContent = title;
  el.errorMessage.textContent = message || "";
}

function hideError() {
  el.errorBanner.classList.add("hidden");
}

/* ---------------- Person ---------------- */

function setPerson(name, { openModal = false } = {}) {
  state.person = name;
  if (name) {
    localStorage.setItem(KEY_PERSON, name);
    el.personChipName.textContent = name;
    el.personChip.classList.remove("hidden");
    el.nameModal.classList.add("hidden");
    refreshMineUI();
  } else {
    el.personChip.classList.add("hidden");
    refreshMineUI();
  }
  if (openModal) openNameModal();
}

function openNameModal() {
  el.nameModalTitle.textContent = state.person ? "Đổi tên người đặt" : "Bạn là ai?";
  el.nameInput.value = state.person || "";
  el.nameModal.classList.remove("hidden");
  setTimeout(() => el.nameInput.focus(), 50);
}

el.nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = el.nameInput.value.trim().slice(0, MAX_NAME_LEN);
  if (!name) {
    el.nameInput.focus();
    return;
  }
  const isNew = name !== state.person;
  setPerson(name);
  if (isNew) toast(`Xin chào ${name}!`, "success");
});

el.personChip.addEventListener("click", () => openNameModal());

/* ---------------- Data loading ---------------- */

async function loadRestaurants() {
  const sb = state.supabase;
  const { data, error } = await sb
    .from("restaurants")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  state.restaurants = data || [];
  renderMenuCards();
}

async function loadDishes(restaurantId) {
  const { data, error } = await state.supabase
    .from("dishes")
    .select("id, name, image_url, is_available, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadOrders() {
  const { data, error } = await state.supabase
    .from("orders")
    .select("id, dish_id, dish_name, restaurant_name, person_name, order_date, created_at")
    .eq("order_date", todayISO())
    .order("created_at", { ascending: true });
  if (error) throw error;
  state.orders = data || [];
  renderOrders();
}

/* ---------------- Reviews: data ---------------- */

function computeReviewStats(rows) {
  const stats = new Map();
  for (const r of rows) {
    const cur = stats.get(r.dish_id) || { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += r.rating;
    stats.set(r.dish_id, cur);
  }
  for (const [id, s] of stats) {
    stats.set(id, { count: s.count, sum: s.sum, avg: s.sum / s.count });
  }
  return stats;
}

function refreshStarBadges() {
  el.dishArea.querySelectorAll("[data-review]").forEach((btn) => {
    const stats = state.reviewStats.get(btn.dataset.review);
    const score = btn.querySelector(".star-score");
    if (score) score.textContent = stats && stats.count ? stats.avg.toFixed(1) : "Mới";
  });
}

async function loadReviewStats(dishIds) {
  if (!dishIds.length) {
    state.reviewStats = new Map();
    return;
  }
  const { data, error } = await state.supabase
    .from("reviews")
    .select("dish_id, rating")
    .in("dish_id", dishIds);
  if (error) throw error;
  state.reviewStats = computeReviewStats(data || []);
}

async function loadReviewsFor(dishId) {
  const { data, error } = await state.supabase
    .from("reviews")
    .select("id, dish_id, dish_name, person_name, rating, comment, created_at")
    .eq("dish_id", dishId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.reviews = data || [];
}

/* ---------------- Render: menus + dishes ---------------- */

function renderMenuCards() {
  if (!state.restaurants.length) {
    el.menuCards.innerHTML =
      '<div class="empty-state">Chưa có quán nào. Vào <a href="setup.html">Quản lý món</a> để thêm.</div>';
    return;
  }
  el.menuCards.innerHTML = state.restaurants
    .map(
      (r) => `
      <button type="button" class="menu-card${r.id === state.activeRestaurantId ? " active" : ""}"
              data-id="${escapeHtml(r.id)}">
        <span class="menu-name">Menu ${escapeHtml(r.name)}</span>
        <span class="menu-meta">Bấm để xem món</span>
      </button>`
    )
    .join("");

  el.menuCards.querySelectorAll(".menu-card").forEach((btn) => {
    btn.addEventListener("click", () => selectRestaurant(btn.dataset.id));
  });
}

async function selectRestaurant(id) {
  state.activeRestaurantId = id;
  renderMenuCards();
  await refreshActiveDishes();
}

async function refreshActiveDishes() {
  const id = state.activeRestaurantId;
  if (!id) return;
  const restaurant = state.restaurants.find((r) => r.id === id);
  el.dishSectionTitle.textContent = restaurant
    ? `2. Chọn món — ${restaurant.name}`
    : "2. Chọn món";
  el.dishArea.innerHTML = '<div class="empty-state">Đang tải món...</div>';
  try {
    state.dishes = await loadDishes(id);
    await loadReviewStats(state.dishes.map((d) => d.id));
    renderDishes();
  } catch (err) {
    el.dishArea.innerHTML = "";
    showError("Không tải được danh sách món.", err.message || String(err));
  }
}

function starGlyph(filled) {
  return filled ? "★" : "☆";
}

function starString(rating, max = 5) {
  const rounded = Math.round(rating);
  let out = "";
  for (let i = 1; i <= max; i++) out += starGlyph(i <= rounded);
  return out;
}

function renderDishes() {
  const list = state.dishes;
  el.dishCount.textContent = list.length ? `${list.length} món` : "";
  if (!list.length) {
    el.dishArea.innerHTML =
      '<div class="empty-state">Quán này chưa có món nào. Vào <a href="setup.html">Quản lý món</a> để thêm.</div>';
    return;
  }

  el.dishArea.innerHTML = `<div class="dish-grid">${list
    .map((d) => {
      const stats = state.reviewStats.get(d.id);
      return `
      <div class="dish-card" data-id="${escapeHtml(d.id)}">
        <div class="dish-thumb">
          <img alt="${escapeHtml(d.name)}" />
          <div class="placeholder"></div>
          <button type="button" class="star-btn" data-review="${escapeHtml(d.id)}"
                  title="Đánh giá ${escapeHtml(d.name)}"
                  aria-label="Đánh giá ${escapeHtml(d.name)}">
            <span class="star-icon">★</span>
            <span class="star-score">${stats && stats.count ? stats.avg.toFixed(1) : "Mới"}</span>
          </button>
        </div>
        <div class="dish-body">
          <div class="dish-name">${escapeHtml(d.name)}</div>
          <button type="button" class="add-btn" data-add="${escapeHtml(d.id)}"
                  data-name="${escapeHtml(d.name)}"
                  title="Thêm ${escapeHtml(d.name)}" aria-label="Thêm ${escapeHtml(d.name)}">+</button>
        </div>
        <span class="dish-badge hidden">Đã chọn</span>
      </div>`;
    })
    .join("")}</div>`;

  el.dishArea.querySelectorAll(".dish-card").forEach((card) => {
    const dish = list.find((d) => d.id === card.dataset.id);
    if (dish) attachDishImage(card.querySelector(".dish-thumb"), dish.image_url, dish.name);
  });

  el.dishArea.querySelectorAll("[data-add]").forEach((btn) => {
    const dish = list.find((d) => d.id === btn.dataset.add);
    btn.setAttribute("data-name", dish ? dish.name : "");
    btn.addEventListener("click", () => addOrder(btn.dataset.add));
  });
  el.dishArea.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => openReviewModal(btn.dataset.review));
  });

  refreshMineUI();
}

/* ---------------- Ordering (1 món / người / ngày) ---------------- */

function myTodayOrders() {
  if (!state.person) return [];
  return state.orders.filter((o) => o.person_name === state.person);
}
async function placeOrder(dishId, { replace = false } = {}) {
  if (!state.person) {
    openNameModal();
    return { ok: false, reason: "no-person" };
  }
  if (state.pendingDishIds.size) return { ok: false, reason: "busy" };

  const dish = state.dishes.find((d) => d.id === dishId);
  const restaurant = state.restaurants.find((r) => r.id === state.activeRestaurantId);
  if (!dish || !restaurant) return { ok: false, reason: "not-found" };

  const mine = myTodayOrders();
  if (!replace && mine.length) return { ok: false, reason: "already-ordered" };

  state.pendingDishIds.add(dishId);
  state.pendingDishIds.add("__all__");
  refreshMineUI();

  try {
    if (replace && mine.length) {
      const { error: delError } = await state.supabase
        .from("orders")
        .delete()
        .eq("order_date", todayISO())
        .eq("person_name", state.person);
      if (delError) throw delError;

      const removedIds = new Set(mine.map((o) => o.id));
      state.orders = state.orders.filter((o) => !removedIds.has(o.id));
      saveLocalOrders(readLocalOrders().filter((id) => !removedIds.has(id)));
    }

    const { data, error } = await state.supabase
      .from("orders")
      .insert({
        dish_id: dish.id,
        dish_name: dish.name,
        restaurant_name: restaurant.name,
        person_name: state.person,
        order_date: todayISO(),
      })
      .select("id, dish_id, dish_name, restaurant_name, person_name, order_date, created_at")
      .single();
    if (error) throw error;

    addLocalOrder(data.id);
    if (!state.orders.some((o) => o.id === data.id)) state.orders.push(data);
    return { ok: true, dish };
  } catch (err) {
    return { ok: false, reason: "error", error: err };
  } finally {
    state.pendingDishIds.delete(dishId);
    state.pendingDishIds.delete("__all__");
    renderOrders();
    refreshMineUI();
    if (replace) {
      try {
        await loadOrders();
      } catch {
        /* giữ danh sách hiện tại nếu reload lỗi */
      }
    }
  }
}

async function addOrder(dishId) {
  if (!state.person) {
    openNameModal();
    return;
  }
  if (state.pendingDishIds.size) return;

  const mine = myTodayOrders();
  if (mine.length) {
    const current = mine[0];
    const target = state.dishes.find((d) => d.id === dishId);
    if (!target) return;
    if (current.dish_id === dishId) {
      toast(`Bạn đã chọn "${current.dish_name}" rồi.`, "");
      return;
    }
    const yes = await askConfirm({
      title: "Bạn đã chọn món rồi",
      message: `Bạn đang chọn "${current.dish_name}" (${current.restaurant_name}). Đổi sang "${target.name}" (${state.restaurants.find((r) => r.id === state.activeRestaurantId)?.name || ""})?`,
      yesLabel: "YES, đổi",
      noLabel: "NO, giữ",
    });
    if (!yes) return;
    const res = await placeOrder(dishId, { replace: true });
    if (res.ok) toast(`Đã đổi sang: ${res.dish.name}`, "success");
    else if (res.reason === "error") toast("Không đổi được: " + res.error.message, "error");
    return;
  }

  const res = await placeOrder(dishId);
  if (res.ok) toast(`Đã thêm: ${res.dish.name}`, "success");
  else if (res.reason === "error") toast("Không thêm được đơn: " + res.error.message, "error");
}

function refreshMineUI() {
  const mine = myTodayOrders();
  const mineDishIds = new Set(mine.map((o) => o.dish_id));
  const busy = state.pendingDishIds.size > 0;

  el.dishArea.querySelectorAll("[data-add]").forEach((btn) => {
    const dishId = btn.dataset.add;
    const selected = mineDishIds.has(dishId);
    const isPending = state.pendingDishIds.has(dishId);
    btn.classList.toggle("done", selected);
    btn.classList.toggle("busy", isPending);
    btn.textContent = selected ? "✓" : isPending ? "…" : "+";
    btn.disabled = isPending || busy || !state.person;
    btn.title = selected
      ? "Bạn đã chọn món này"
      : mine.length
      ? `Đổi sang ${btn.getAttribute("data-name") || "món này"}`
      : btn.getAttribute("data-name") || "Thêm món";

    const card = btn.closest(".dish-card");
    if (card) {
      card.classList.toggle("selected", selected);
      card.classList.toggle("dimmed", mine.length > 0 && !selected);
      const badge = card.querySelector(".dish-badge");
      if (badge) badge.classList.toggle("hidden", !selected);
    }
  });

  renderMyPickBar();
  renderOrders();
}

function renderMyPickBar() {
  if (!el.myPickBar) return;
  const mine = myTodayOrders();
  if (!state.person || !mine.length) {
    el.myPickBar.classList.add("hidden");
    return;
  }
  const o = mine[0];
  el.myPickBar.classList.remove("hidden");
  el.myPickText.innerHTML = `Bạn hôm nay: <b>${escapeHtml(o.dish_name)}</b> (${escapeHtml(
    o.restaurant_name
  )})`;
}

/* ---------------- Confirm (YES / NO) ---------------- */

const confirmState = { resolve: null, returnFocus: null };

function askConfirm({ title, message, yesLabel = "YES", noLabel = "NO" }) {
  if (!el.confirmModal) return Promise.resolve(window.confirm(message));
  if (confirmState.resolve) confirmState.resolve(false);

  el.confirmTitle.textContent = title || "";
  el.confirmMessage.textContent = message || "";
  el.confirmYes.textContent = yesLabel;
  el.confirmNo.textContent = noLabel;
  confirmState.returnFocus = document.activeElement;
  el.confirmModal.classList.remove("hidden");
  setTimeout(() => el.confirmYes.focus(), 40);

  return new Promise((resolve) => {
    confirmState.resolve = resolve;
  });
}

function resolveConfirm(answer) {
  if (!confirmState.resolve) return;
  el.confirmModal.classList.add("hidden");
  const resolve = confirmState.resolve;
  confirmState.resolve = null;
  const focus = confirmState.returnFocus;
  confirmState.returnFocus = null;
  if (focus && typeof focus.focus === "function") focus.focus();
  resolve(answer);
}

if (el.confirmYes) el.confirmYes.addEventListener("click", () => resolveConfirm(true));
if (el.confirmNo) el.confirmNo.addEventListener("click", () => resolveConfirm(false));
if (el.confirmModal) {
  el.confirmModal.addEventListener("click", (e) => {
    if (e.target === el.confirmModal) resolveConfirm(false);
  });
}

/* ---------------- Lucky spin: gợi ý món ---------------- */

const spinState = { angle: 0, spinning: false, cooldown: 0 };

const SPIN_COLORS = [
  "#ff6b6b", "#f59e0b", "#22c55e", "#3b82f6",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
  "#84cc16", "#6366f1",
];

  "#ff6b6b", "#f59e0b", "#22c55e", "#3b82f6",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
  "#84cc16", "#6366f1",
];

function wheelLabel(name) {
  const text = String(name || "");
  return text.length > 22 ? text.slice(0, 21) + "…" : text;
}

function drawWheel(items) {
  if (!el.spinCanvas) return;
  const canvas = el.spinCanvas;
  const size = canvas.clientWidth || 300;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;

  if (!items.length) {
    ctx.fillStyle = "#f3f4f6";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ca3af";
    ctx.font = `600 ${Math.round(size / 18)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Chưa có món nào", cx, cy);
    return;
  }

  const n = items.length;
  const slice = (Math.PI * 2) / n;

  for (let i = 0; i < n; i++) {
    const start = i * slice - Math.PI / 2;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = SPIN_COLORS[i % SPIN_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.max(10, Math.round(size / (n > 12 ? 26 : 20)))}px system-ui, sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = 3;
    ctx.fillText(wheelLabel(items[i].name), r - 14, 0);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(20, size * 0.1), 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function renderWheelRotation() {
  if (el.spinWheelInner) {
    el.spinWheelInner.style.transform = `rotate(${spinState.angle}deg)`;
  }
}

function pickSpinDish(items) {
  const n = items.length;
  const sliceDeg = 360 / n;
  const normalized = ((-spinState.angle % 360) + 360) % 360;
  const index = Math.floor(normalized / sliceDeg) % n;
  return { dish: items[index], index };
}

async function ensureSpinPool() {
  if (state.allDishes && state.allDishes.length) return state.allDishes;
  const { data, error } = await state.supabase
    .from("dishes")
    .select("id, name, image_url, restaurant_id, sort_order")
    .eq("is_available", true)
    .order("name", { ascending: true });
  if (error) throw error;
  state.allDishes = data || [];
  return state.allDishes;
}

async function openSpinModal() {
  if (!state.person) {
    openNameModal();
    return;
  }
  el.spinModal.classList.remove("hidden");
  el.spinResult.classList.add("hidden");
  el.spinResultCard.innerHTML = "";
  el.spinDishName.textContent = "Đang chuẩn bị món...";
  setSpinButton(true);

  if (!state.allDishes.length) {
    drawWheel([]);
    try {
      await ensureSpinPool();
    } catch (err) {
      el.spinDishName.textContent = "Không tải được danh sách món.";
      toast("Lỗi: " + (err.message || String(err)), "error");
      return;
    }
  }

  spinState.angle = 0;
  renderWheelRotation();
  drawWheel(state.allDishes);
  setSpinButton(false);
  el.spinDishName.textContent = "Bấm QUAY để xem vận may!";
}

function setSpinButton(busy) {
  if (!el.spinGoBtn) return;
  el.spinGoBtn.disabled = busy || spinState.spinning;
  el.spinGoBtn.classList.toggle("spinning", !!busy || spinState.spinning);
  el.spinGoBtn.textContent = busy || spinState.spinning ? "Đang quay..." : "QUAY NGAY";
}

function closeSpinModal() {
  if (spinState.spinning) return;
  el.spinModal.classList.add("hidden");
}

async function spinWheel() {
  if (spinState.spinning) return;
  const items = state.allDishes || [];
  if (!items.length) {
    toast("Chưa có món nào để gợi ý.", "error");
    return;
  }
  if (state.pendingDishIds.size) return;

  spinState.spinning = true;
  setSpinButton(true);
  el.spinResult.classList.add("hidden");
  el.spinDishName.textContent = "Quay... may mắn nào!";

  const n = items.length;
  const sliceDeg = 360 / n;
  const targetIndex = Math.floor(Math.random() * n);
  const jitter = (Math.random() - 0.5) * sliceDeg * 0.55;
  const currentNormalized = ((-spinState.angle % 360) + 360) % 360;
  const currentIndex = currentNormalized / sliceDeg;
  const turns = 5 + Math.floor(Math.random() * 3);
  const extraSlices = (targetIndex - currentIndex + n) % n;
  spinState.angle -= turns * 360;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      spinState.angle -= extraSlices * sliceDeg + jitter;
      renderWheelRotation();
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 3700));

  const dish = items[targetIndex];
  spinState.spinning = false;
  setSpinButton(false);

  el.spinDishName.textContent = "Món dành cho bạn là...";
  el.spinResultCard.innerHTML = `
    <div class="spin-result-thumb"><img alt="" /><div class="placeholder"></div></div>
    <div class="spin-result-info">
      <div class="spin-result-name"></div>
      <div class="spin-result-sub"></div>
    </div>`;
  const thumb = el.spinResultCard.querySelector(".spin-result-thumb");
  attachDishImage(thumb, dish.image_url, dish.name);
  el.spinResultCard.querySelector(".spin-result-name").textContent = dish.name;
  const restaurant = state.restaurants.find((r) => r.id === dish.restaurant_id);
  el.spinResultCard.querySelector(".spin-result-sub").textContent = restaurant
    ? `Menu ${restaurant.name}`
    : "";
  el.spinResult.classList.remove("hidden");

  const yes = await askConfirm({
    title: `Bạn muốn chọn "${dish.name}" chứ?`,
    message: restaurant
      ? `Món từ menu ${restaurant.name}. Chọn YES để đặt ngay.`
      : "Chọn YES để đặt ngay.",
    yesLabel: "YES, chốt món",
    noLabel: "NO, quay lại",
  });

  if (!yes) {
    el.spinDishName.textContent = "Không sao, quay tiếp khi bạn muốn!";
    return;
  }

  const currentMine = myTodayOrders();
  if (currentMine.length && currentMine[0].dish_id !== dish.id) {
    const acceptSwap = await askConfirm({
      title: "Bạn đã chọn món rồi",
      message: `Bạn đang chọn "${currentMine[0].dish_name}". Đổi sang "${dish.name}"?`,
      yesLabel: "YES, đổi",
      noLabel: "NO, giữ",
    });
    if (!acceptSwap) return;
  }

  const res = await placeOrder(dish.id, { replace: currentMine.length > 0 });
  if (res.ok) {
    toast(`Đã đặt: ${dish.name}`, "success");
    closeSpinModal();
  } else if (res.reason === "error") {
    toast("Không đặt được: " + res.error.message, "error");
  }
}

if (el.spinFab) el.spinFab.addEventListener("click", () => openSpinModal());
if (el.spinGoBtn) el.spinGoBtn.addEventListener("click", () => spinWheel());
if (el.spinCloseBtn) el.spinCloseBtn.addEventListener("click", () => closeSpinModal());
if (el.spinModal) {
  el.spinModal.addEventListener("click", (e) => {
    if (e.target === el.spinModal) closeSpinModal();
  });
}

window.addEventListener("resize", () => {
  if (el.spinModal && !el.spinModal.classList.contains("hidden")) {
    drawWheel(state.allDishes || []);
  }
});

/* ---------------- Reviews: modal ---------------- */
  el.reviewStarsInput.querySelectorAll(".rate-star").forEach((btn) => {
    const value = Number(btn.dataset.value);
    const on = value <= state.selectedRating;
    btn.classList.toggle("on", on);
    btn.textContent = starGlyph(on);
  });
  el.reviewStarsInput.querySelectorAll(".rate-star").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(Number(btn.dataset.value) === state.selectedRating));
  });
  const labels = ["", "Rất tệ", "Tệ", "Bình thường", "Ngon", "Tuyệt vời"];
  el.reviewHint.textContent = state.selectedRating
    ? `Bạn chọn ${state.selectedRating}/5 — ${labels[state.selectedRating]}`
    : "Chọn 1–5 sao để gửi đánh giá.";
  el.reviewSubmitBtn.disabled = state.reviewBusy || !state.selectedRating || !state.person;
}

function renderReviews() {
  const rows = state.reviews;
  const stats = state.reviewStats.get(state.activeDish && state.activeDish.id);
  el.reviewSummary.innerHTML = stats && stats.count
    ? `<span class="big-score">${stats.avg.toFixed(1)}</span>
       <span class="summary-stars">${starString(stats.avg)}</span>
       <span class="muted">${stats.count} đánh giá</span>`
    : '<span class="muted">Chưa có đánh giá nào — hãy là người đầu tiên.</span>';

  if (!rows.length) {
    el.reviewList.innerHTML = "";
    el.reviewEmpty.classList.remove("hidden");
    return;
  }
  el.reviewEmpty.classList.add("hidden");

  el.reviewList.innerHTML = rows
    .map((r) => {
      const when = new Date(r.created_at).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
      <li class="review-item" data-id="${escapeHtml(r.id)}">
        <div class="review-head">
          <span class="review-stars">${starString(r.rating)}</span>
          <span class="review-author">${escapeHtml(r.person_name)}</span>
          <span class="review-time">${escapeHtml(when)}</span>
          <button type="button" class="del-btn" data-unreview="${escapeHtml(
            r.id
          )}" title="Xóa đánh giá của ${escapeHtml(r.person_name)}" aria-label="Xóa đánh giá">✕</button>
        </div>
        ${r.comment ? `<div class="review-comment">${escapeHtml(r.comment)}</div>` : ""}
      </li>`;
    })
    .join("");

  el.reviewList.querySelectorAll("[data-unreview]").forEach((btn) => {
    btn.addEventListener("click", () => deleteReview(btn.dataset.unreview));
  });
}

async function openReviewModal(dishId) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return;

  state.activeDish = dish;
  state.selectedRating = 0;
  state.reviews = [];
  el.reviewDishName.textContent = dish.name;
  el.reviewComment.value = "";
  el.reviewHint.textContent = "Chọn 1–5 sao để gửi đánh giá.";
  el.reviewList.innerHTML = "";
  el.reviewEmpty.textContent = "Đang tải đánh giá...";
  el.reviewEmpty.classList.remove("hidden");
  renderStarInput();
  renderReviews();
  el.reviewModal.classList.remove("hidden");

  try {
    await loadReviewsFor(dishId);
    renderReviews();
  } catch (err) {
    el.reviewEmpty.textContent = "Không tải được đánh giá.";
    el.reviewEmpty.classList.remove("hidden");
    toast("Lỗi tải đánh giá: " + (err.message || String(err)), "error");
  }
}

function closeReviewModal() {
  el.reviewModal.classList.add("hidden");
  state.activeDish = null;
  state.reviews = [];
  state.selectedRating = 0;
}

el.reviewStarsInput.querySelectorAll(".rate-star").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.selectedRating = Number(btn.dataset.value);
    renderStarInput();
  });
});

el.reviewStarsInput.addEventListener("mouseleave", () => renderStarInput());

el.reviewCloseBtn.addEventListener("click", () => closeReviewModal());

el.reviewModal.addEventListener("click", (e) => {
  if (e.target === el.reviewModal) closeReviewModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!el.confirmModal.classList.contains("hidden")) {
    resolveConfirm(false);
    return;
  }
  if (!el.reviewModal.classList.contains("hidden")) closeReviewModal();
  if (!el.spinModal.classList.contains("hidden")) closeSpinModal();
});

el.reviewSubmitBtn.addEventListener("click", () => submitReview());

async function submitReview() {
  const dish = state.activeDish;
  if (!dish || state.reviewBusy) return;
  if (!state.person) {
    openNameModal();
    return;
  }
  if (!state.selectedRating) {
    toast("Chọn số sao trước đã.", "error");
    return;
  }

  state.reviewBusy = true;
  renderStarInput();
  el.reviewSubmitBtn.textContent = "Đang gửi...";

  const comment = el.reviewComment.value.trim().slice(0, 300);
  const { data, error } = await state.supabase
    .from("reviews")
    .insert({
      dish_id: dish.id,
      dish_name: dish.name,
      person_name: state.person,
      rating: state.selectedRating,
      comment: comment || null,
    })
    .select("id, dish_id, dish_name, person_name, rating, comment, created_at")
    .single();

  state.reviewBusy = false;
  el.reviewSubmitBtn.textContent = "Gửi đánh giá";

  if (error) {
    toast("Không gửi được đánh giá: " + error.message, "error");
    renderStarInput();
    return;
  }

  const existing = state.reviewStats.get(dish.id) || { count: 0, sum: 0, avg: 0 };
  const count = existing.count + 1;
  const sum = existing.sum + data.rating;
  state.reviewStats.set(dish.id, { count, sum, avg: sum / count });

  if (!state.reviews.some((r) => r.id === data.id)) {
    state.reviews.unshift(data);
  }
  state.selectedRating = 0;
  el.reviewComment.value = "";
  renderStarInput();
  renderReviews();
  refreshStarBadges();
  toast("Cảm ơn đánh giá của bạn!", "success");
}

async function deleteReview(reviewId) {
  const review = state.reviews.find((r) => r.id === reviewId);
  if (!review) return;
  if (!window.confirm(`Xóa đánh giá ${review.rating}★ của ${review.person_name}?`)) return;

  const { error } = await state.supabase.from("reviews").delete().eq("id", reviewId);
  if (error) {
    toast("Không xóa được: " + error.message, "error");
    return;
  }

  const dishId = review.dish_id;
  state.reviews = state.reviews.filter((r) => r.id !== reviewId);
  const cur = state.reviewStats.get(dishId) || { count: 0, sum: 0, avg: 0 };
  const count = Math.max(cur.count - 1, 0);
  const sum = Math.max(cur.sum - review.rating, 0);
  if (count === 0) state.reviewStats.delete(dishId);
  else state.reviewStats.set(dishId, { count, sum, avg: sum / count });

  renderReviews();
  refreshStarBadges();
  toast("Đã xóa đánh giá.", "success");
}

function refreshMineUI() {
  el.dishArea.querySelectorAll("[data-add]").forEach((btn) => {
    const dishId = btn.dataset.add;
    const mine = state.orders.some(
      (o) => o.dish_id === dishId && o.person_name === state.person && isMine(o.id)
    );
    const busy = state.pendingDishIds.has(dishId);
    btn.disabled = mine || busy || !state.person;
    btn.classList.toggle("done", mine);
    btn.textContent = mine ? "✓" : busy ? "…" : "+";

    const card = btn.closest(".dish-card");
    if (card) {
      card.classList.toggle("selected", mine);
      const badge = card.querySelector(".dish-badge");
      if (badge) badge.classList.toggle("hidden", !mine);
    }
  });
  renderOrders();
}

/* ---------------- Render: order list ---------------- */

function renderOrders() {
  const orders = state.orders;
  el.orderCount.textContent = `${orders.length} đơn`;
  el.copyBtn.disabled = orders.length === 0;

  if (!orders.length) {
    el.orderList.innerHTML = "";
    el.orderEmpty.classList.remove("hidden");
    return;
  }
  el.orderEmpty.classList.add("hidden");

  el.orderList.innerHTML = orders
    .map((o) => {
      const mine = isMine(o.id);
      return `
      <li class="order-item${mine ? " mine" : ""}" data-id="${escapeHtml(o.id)}">
        <span class="order-text"><b>${escapeHtml(o.dish_name)}</b>_(${escapeHtml(
        o.restaurant_name
      )}) - ${escapeHtml(o.person_name)}</span>
        <button type="button" class="del-btn" data-del="${escapeHtml(o.id)}"
                title="Xóa đơn này" aria-label="Xóa đơn của ${escapeHtml(o.person_name)}">✕</button>
      </li>`;
    })
    .join("");

  el.orderList.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteOrder(btn.dataset.del));
  });
}

async function deleteOrder(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;
  const label = `"${order.dish_name}" của ${order.person_name}`;
  if (!window.confirm(`Xóa đơn ${label}?`)) return;

  const { error } = await state.supabase.from("orders").delete().eq("id", orderId);
  if (error) {
    toast("Không xóa được: " + error.message, "error");
    return;
  }
  removeLocalOrder(orderId);
  state.orders = state.orders.filter((o) => o.id !== orderId);
  refreshMineUI();
  toast("Đã xóa đơn.", "success");
}

/* ---------------- Copy ---------------- */

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* rơi xuống fallback */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-1000px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

el.copyBtn.addEventListener("click", async () => {
  if (!state.orders.length) return;
  const text = state.orders.map(orderLine).join("\n");
  const ok = await copyText(text);
  if (ok) toast(`Đã copy ${state.orders.length} đơn.`, "success");
  else toast("Không copy được. Hãy chọn tay trong danh sách.", "error");
});

/* ---------------- Realtime ---------------- */

function subscribeRealtime() {
  if (state.realtimeChannel) state.supabase.removeChannel(state.realtimeChannel);

  const today = todayISO();
  state.realtimeChannel = state.supabase
    .channel("datcom-orders-" + today)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      ({ new: row }) => {
        if (row.order_date !== today) return;
        if (state.orders.some((o) => o.id === row.id)) return;
        state.orders.push(row);
        renderOrders();
        refreshMineUI();
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "orders" },
      ({ old: row }) => {
        if (!state.orders.some((o) => o.id === row.id)) return;
        state.orders = state.orders.filter((o) => o.id !== row.id);
        renderOrders();
        refreshMineUI();
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dishes" },
      () => {
        state.allDishes = [];
        if (state.activeRestaurantId) refreshActiveDishes();
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "reviews" },
      ({ new: row }) => {
        if (state.activeDish && row.dish_id === state.activeDish.id) {
          if (!state.reviews.some((r) => r.id === row.id)) {
            state.reviews.unshift(row);
            renderReviews();
          }
        }
        if (!state.dishes.some((d) => d.id === row.dish_id)) return;
        const cur = state.reviewStats.get(row.dish_id) || { count: 0, sum: 0, avg: 0 };
        const count = cur.count + 1;
        const sum = cur.sum + row.rating;
        state.reviewStats.set(row.dish_id, { count, sum, avg: sum / count });
        refreshStarBadges();
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "reviews" },
      ({ old: row }) => {
        if (!state.reviews.some((r) => r.id === row.id)) return;
        state.reviews = state.reviews.filter((r) => r.id !== row.id);
        renderReviews();
        if (!state.dishes.some((d) => d.id === row.dish_id)) return;
        const cur = state.reviewStats.get(row.dish_id);
        if (!cur) return;
        const count = Math.max(cur.count - 1, 0);
        if (count === 0) state.reviewStats.delete(row.dish_id);
        else {
          const sum = Math.max(cur.sum - row.rating, 0);
          state.reviewStats.set(row.dish_id, { count, sum, avg: sum / count });
        }
        refreshStarBadges();
      }
    )
    .subscribe();
}

/* ---------------- Boot ---------------- */

async function loadAll() {
  hideError();
  try {
    await Promise.all([loadRestaurants(), loadOrders()]);
    if (state.restaurants.length) {
      const keep = state.restaurants.some((r) => r.id === state.activeRestaurantId);
      if (!keep) await selectRestaurant(state.restaurants[0].id);
      else await refreshActiveDishes();
    }
    state.loaded = true;
    subscribeRealtime();
  } catch (err) {
    showError("Không kết nối được Supabase.", err.message || String(err));
  }
}

el.retryBtn.addEventListener("click", () => loadAll());

async function init() {
  el.todayLabel.textContent = formatTodayLabel();

  if (!isConfigured()) {
    el.configBanner.classList.remove("hidden");
    el.dishArea.innerHTML =
      '<div class="empty-state">Chưa cấu hình Supabase — xem banner phía trên.</div>';
    return;
  }

  try {
    state.supabase = await getSupabase();
  } catch (err) {
    showError("Không tải được thư viện Supabase.", err.message || String(err));
    return;
  }

  const savedPerson = (localStorage.getItem(KEY_PERSON) || "").trim();
  setPerson(savedPerson);
  if (!savedPerson) openNameModal();

  await loadAll();
}

init();
