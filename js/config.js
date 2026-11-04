// Điền 2 giá trị lấy từ Supabase Dashboard > Project Settings > API
// (xem hướng dẫn chi tiết trong README.md)
export const SUPABASE_URL = "https://wqnhforhekyyyfgbbfsd.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxbmhmb3JoZWt5eXlmZ2JiZnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MTMxNDMsImV4cCI6MjEwOTE4OTE0M30.Xd-W4J05k7nN3-uG9EuNWE2W7MAVy6xMBi0SfeJyDKg";

// Bucket lưu ảnh món (phải khớp với supabase/schema.sql)
export const IMAGE_BUCKET = "dish-images";

// Giới hạn dung lượng ảnh upload (bytes)
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

// Thời tiết: TP.HCM (Open-Meteo, không cần key)
export const WEATHER_LAT = 10.7769;
export const WEATHER_LON = 106.7009;
export const WEATHER_CITY = "TP.HCM";
export const WEATHER_TZ = "Asia/Ho_Chi_Minh";

// Chốt đơn: 18:00 các ngày T2–T6 (0 = CN, 6 = T7)
export const CUTOFF_HOUR = 18;
export const CUTOFF_WEEKDAYS = [1, 2, 3, 4, 5];

// Popup nhắc đặt cơm: 16:30 → tới giờ chốt
export const REMINDER_START_MINUTES = 16 * 60 + 30;
export const REMINDER_SNOOZE_MIN = 15;

// Nhắc uống nước: mỗi giờ từ 9:00 → 18:00, bỏ qua giờ nghỉ trưa 11:00–13:00
// (không nhắc lúc 11h, 12h; tiếp tục từ 13h).
export const WATER_START_HOUR = 9;
export const WATER_END_HOUR = 18;
export const WATER_LUNCH_START_HOUR = 11;
export const WATER_LUNCH_END_HOUR = 13;

export const isConfigured = () =>
  SUPABASE_URL.trim().startsWith("http") && SUPABASE_ANON_KEY.trim().length > 20;
