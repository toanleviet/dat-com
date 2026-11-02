// Điền 2 giá trị lấy từ Supabase Dashboard > Project Settings > API
// (xem hướng dẫn chi tiết trong README.md)
export const SUPABASE_URL = "https://wqnhforhekyyyfgbbfsd.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxbmhmb3JoZWt5eXlmZ2JiZnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MTMxNDMsImV4cCI6MjEwOTE4OTE0M30.Xd-W4J05k7nN3-uG9EuNWE2W7MAVy6xMBi0SfeJyDKg";

// Bucket lưu ảnh món (phải khớp với supabase/schema.sql)
export const IMAGE_BUCKET = "dish-images";

// Giới hạn dung lượng ảnh upload (bytes)
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export const isConfigured = () =>
  SUPABASE_URL.trim().startsWith("http") && SUPABASE_ANON_KEY.trim().length > 20;
