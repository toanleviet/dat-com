import { isConfigured, CUTOFF_HOUR, CUTOFF_WEEKDAYS } from "./config.js";
import { getSupabase } from "./supabase-client.js";
import { monthKey, lastDayOfMonth, isWorkday } from "./schedule.js";

const el = {
  configBanner: document.getElementById("configBanner"),
  month: document.getElementById("historyMonth"),
  reload: document.getElementById("historyReload"),
  summary: document.getElementById("historySummary"),
  list: document.getElementById("historyList"),
  empty: document.getElementById("historyEmpty"),
};

const MAX_ROWS = 5000;

function pad(n) {
  return String(n).padStart(2, "0");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "2026-11-04" → "Thứ Tư, 04/11/2026" */
function formatDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("vi-VN", { weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${pad(d)}/${pad(m)}/${y}`;
}

function dayBadge(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const workday = isWorkday(date, CUTOFF_WEEKDAYS);
  return workday
    ? `<span class="badge badge-lock">🔒 chốt ${CUTOFF_HOUR}:00</span>`
    : '<span class="badge">cuối tuần</span>';
}

function groupByDay(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.order_date)) map.set(r.order_date, []);
    map.get(r.order_date).push(r);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function render(rows) {
  const days = groupByDay(rows);
  const people = new Set(rows.map((r) => r.person_name));

  if (el.summary) {
    el.summary.textContent = rows.length
      ? `${days.length} ngày · ${rows.length} đơn · ${people.size} người`
      : "";
  }

  el.empty?.classList.toggle("hidden", rows.length > 0);
  if (!el.list) return;

  el.list.innerHTML = days
    .map(([date, items]) => {
      const ordered = items
        .slice()
        .sort((a, b) => a.person_name.localeCompare(b.person_name, "vi"));
      const meals = ordered
        .map(
          (o) => `
          <li class="history-item">
            <span class="history-person">${escapeHtml(o.person_name)}</span>
            <span class="history-dish">${escapeHtml(o.dish_name)}</span>
            <span class="history-rest">${escapeHtml(o.restaurant_name)}</span>
          </li>`
        )
        .join("");
      return `
        <section class="card history-day">
          <div class="history-day-head">
            <strong>${escapeHtml(formatDay(date))}</strong>
            ${dayBadge(date)}
            <span class="small muted">${items.length} đơn</span>
          </div>
          <ul class="history-items">${meals}</ul>
        </section>`;
    })
    .join("");
}

async function load() {
  if (!isConfigured()) {
    el.configBanner?.classList.remove("hidden");
    return;
  }

  const month = (el.month?.value || monthKey()).slice(0, 7);
  const from = `${month}-01`;
  const to = lastDayOfMonth(month);

  el.list.innerHTML = '<div class="empty-state">Đang tải...</div>';
  el.empty?.classList.add("hidden");

  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from("orders")
      .select("id, order_date, person_name, dish_name, restaurant_name, created_at")
      .gte("order_date", from)
      .lte("order_date", to)
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;
    render(data || []);
  } catch (err) {
    el.list.innerHTML = `<div class="banner banner-error">Không tải được lịch sử: ${escapeHtml(
      err.message || String(err)
    )}</div>`;
  }
}

if (el.month) {
  el.month.value = monthKey();
  el.month.addEventListener("change", load);
}
el.reload?.addEventListener("click", load);
load();
