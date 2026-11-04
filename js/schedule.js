import { CUTOFF_HOUR, CUTOFF_WEEKDAYS, REMINDER_START_MINUTES } from "./config.js";

/** "YYYY-MM-DD" theo giờ máy. */
export function isoDate(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Ngày làm việc? (mặc định T2–T6) */
export function isWorkday(date = new Date(), weekdays = CUTOFF_WEEKDAYS) {
  return weekdays.includes(date.getDay());
}

/** Mốc chốt của ngày `date` (18:00). */
export function cutoffAt(date = new Date(), cutoffHour = CUTOFF_HOUR) {
  const d = new Date(date);
  d.setHours(cutoffHour, 0, 0, 0);
  return d;
}

/** Hôm nay đã qua giờ chốt chưa (chỉ ngày làm việc mới chốt). */
export function isPastCutoff(now = new Date()) {
  if (!isWorkday(now)) return false;
  return now.getTime() >= cutoffAt(now).getTime();
}

/**
 * Ngày `orderDate` (YYYY-MM-DD) có bị khoá không.
 * - Ngày trước hôm nay: luôn khoá (lịch sử, chỉ xem).
 * - Hôm nay: khoá nếu đã qua giờ chốt.
 * - Ngày tương lai: mở.
 */
export function isDateLocked(orderDate, now = new Date()) {
  const today = isoDate(now);
  if (orderDate < today) return true;
  if (orderDate > today) return false;
  return isPastCutoff(now);
}

/** Thông điệp khi bị khoá. */
export function lockMessage(cutoffHour = CUTOFF_HOUR) {
  return `Đã chốt đơn lúc ${cutoffHour}:00 hôm nay.`;
}

/** Còn trong khung nhắc đặt cơm (16:30 → giờ chốt, ngày làm việc)? */
export function isReminderWindow(now = new Date(), cutoffHour = CUTOFF_HOUR) {
  if (!isWorkday(now)) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < REMINDER_START_MINUTES) return false;
  return now.getTime() < cutoffAt(now, cutoffHour).getTime();
}

/** Số phút còn lại tới giờ chốt. */
export function minutesToCutoff(now = new Date(), cutoffHour = CUTOFF_HOUR) {
  const ms = cutoffAt(now, cutoffHour).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 60000));
}

/** "2026-11" từ Date. */
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Ngày cuối cùng của tháng "YYYY-MM" → "YYYY-MM-DD". */
export function lastDayOfMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 0);
  return isoDate(d);
}
