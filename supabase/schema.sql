-- =============================================================
-- Tool đặt cơm công ty - schema Supabase
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- (New query > dán > Run). Có thể chạy lại nhiều lần an toàn.
-- =============================================================

-- ---------- Bảng ----------

create table if not exists public.restaurants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.dishes (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  image_url     text,
  is_available  boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists dishes_restaurant_idx on public.dishes (restaurant_id, sort_order);

-- Snapshot dish_name/restaurant_name để đơn cũ không vỡ khi món bị xóa/đổi tên.
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  dish_id         uuid references public.dishes(id) on delete set null,
  dish_name       text not null,
  restaurant_name text not null,
  person_name     text not null,
  order_date      date not null,
  created_at      timestamptz not null default now(),
  constraint person_name_len check (char_length(person_name) between 1 and 40)
);

create index if not exists orders_date_idx on public.orders (order_date, created_at);

-- ---------- Row Level Security ----------
-- KHÔNG có đăng nhập: mọi request dùng anon key đều được đọc/ghi theo policy dưới.
-- Chỉ phù hợp cho tool nội bộ.

alter table public.restaurants enable row level security;
alter table public.dishes      enable row level security;
alter table public.orders      enable row level security;

drop policy if exists "restaurants read"   on public.restaurants;
create policy "restaurants read"   on public.restaurants for select to anon, authenticated using (true);

drop policy if exists "dishes read"        on public.dishes;
create policy "dishes read"        on public.dishes for select to anon, authenticated using (true);

drop policy if exists "dishes insert"      on public.dishes;
create policy "dishes insert"      on public.dishes for insert to anon, authenticated with check (true);

drop policy if exists "dishes update"      on public.dishes;
create policy "dishes update"      on public.dishes for update to anon, authenticated using (true) with check (true);

drop policy if exists "dishes delete"      on public.dishes;
create policy "dishes delete"      on public.dishes for delete to anon, authenticated using (true);

drop policy if exists "orders read"        on public.orders;
create policy "orders read"        on public.orders for select to anon, authenticated using (true);

drop policy if exists "orders insert"      on public.orders;
create policy "orders insert"      on public.orders for insert to anon, authenticated with check (true);

-- Client chỉ hiển thị nút xóa cho order_id nằm trong localStorage của máy đó;
-- server không phân biệt được người dùng nên DELETE mở cho tất cả.
drop policy if exists "orders delete"      on public.orders;
create policy "orders delete"      on public.orders for delete to anon, authenticated using (true);

-- ---------- Realtime ----------
do $$
declare
  t text;
begin
  foreach t in array array['orders', 'dishes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Storage bucket ảnh món ----------
insert into storage.buckets (id, name, public)
values ('dish-images', 'dish-images', true)
on conflict (id) do update set public = true;

drop policy if exists "dish images read"   on storage.objects;
create policy "dish images read"   on storage.objects for select to anon, authenticated
  using (bucket_id = 'dish-images');

drop policy if exists "dish images insert" on storage.objects;
create policy "dish images insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'dish-images');

drop policy if exists "dish images update" on storage.objects;
create policy "dish images update" on storage.objects for update to anon, authenticated
  using (bucket_id = 'dish-images') with check (bucket_id = 'dish-images');

drop policy if exists "dish images delete" on storage.objects;
create policy "dish images delete" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'dish-images');

-- ---------- Seed: 2 quán ----------
insert into public.restaurants (name, sort_order) values
  ('Hải Nam', 1),
  ('Dejavu',  2)
on conflict (name) do nothing;

-- ---------- Seed: món mẫu (image_url = null -> hiện placeholder) ----------
insert into public.dishes (restaurant_id, name, sort_order)
select r.id, d.name, d.sort_order
from (values
  ('Hải Nam', 'Cơm sườn',              1),
  ('Hải Nam', 'Cơm gà nướng',          2),
  ('Hải Nam', 'Cơm cá kho',            3),
  ('Hải Nam', 'Cơm thịt kho trứng',    4),
  ('Hải Nam', 'Cơm bò xào rau',        5),
  ('Hải Nam', 'Cơm chay',              6),
  ('Dejavu',  'Cơm bò lúc lắc',        1),
  ('Dejavu',  'Cơm gà teriyaki',       2),
  ('Dejavu',  'Cơm cá hồi áp chảo',    3),
  ('Dejavu',  'Cơm sườn nướng mật ong',4),
  ('Dejavu',  'Cơm tôm chiên bơ tỏi',  5),
  ('Dejavu',  'Cơm trộn Hàn Quốc',     6)
) as d(restaurant_name, name, sort_order)
join public.restaurants r on r.name = d.restaurant_name
where not exists (
  select 1 from public.dishes x
  where x.restaurant_id = r.id and x.name = d.name
);

-- =============================================================
-- MIGRATION: Đánh giá món (reviews)
-- Chạy phần dưới đây nếu bạn đã tạo database từ phiên bản schema cũ.
-- Chạy lại nhiều lần vẫn an toàn.
-- =============================================================

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  dish_id       uuid not null references public.dishes(id) on delete cascade,
  dish_name     text not null,
  person_name   text not null,
  rating        int  not null,
  comment       text,
  created_at    timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_person_len   check (char_length(person_name) between 1 and 40),
  constraint reviews_comment_len  check (comment is null or char_length(comment) <= 300)
);

create index if not exists reviews_dish_idx on public.reviews (dish_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "reviews read"   on public.reviews;
create policy "reviews read"   on public.reviews for select to anon, authenticated using (true);

drop policy if exists "reviews insert" on public.reviews;
create policy "reviews insert" on public.reviews for insert to anon, authenticated with check (true);

drop policy if exists "reviews delete" on public.reviews;
create policy "reviews delete" on public.reviews for delete to anon, authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews'
  ) then
    execute 'alter publication supabase_realtime add table public.reviews';
  end if;
end $$;

-- ---------- (Tuỳ chọn) Tự xóa đơn cũ hơn 31 ngày bằng pg_cron ----------
-- Chỉ chạy nếu project hỗ trợ extension pg_cron. Nếu lỗi, bỏ qua phần này
-- và dùng nút "Xóa toàn bộ đơn" ở trang setup.html.
--
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'purge-old-orders',
--   '0 1 * * *',
--   $$ delete from public.orders where order_date < current_date - interval '31 days' $$
-- );
