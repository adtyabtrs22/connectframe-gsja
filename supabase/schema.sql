-- Jalankan script ini di Supabase SQL Editor untuk menyiapkan database & storage

-- 1. Tabel Frames (menyimpan template frame & posisi 4 kotak foto)
create table if not exists public.frames (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  frame_url text,
  background_color text not null default '#ffffff',
  frame_z_index integer not null default 5,
  canvas_width integer not null default 1080,
  canvas_height integer not null default 1920,
  slots jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Tabel Photos (menyimpan metadata foto terkompresi untuk Galeri Bersama)
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  sender_name text,
  frame_name text,
  created_at timestamptz not null default now()
);

-- 3. Aktifkan Row Level Security (RLS)
alter table public.frames enable row level security;
alter table public.photos enable row level security;

-- Kebijakan akses publik (untuk jemaat scan QR tanpa login)
create policy "Public read active frames"
  on public.frames for select
  using (is_active = true);

create policy "Public insert frames (Admin UI)"
  on public.frames for insert
  with check (true);

create policy "Public update frames (Admin UI)"
  on public.frames for update
  using (true);

create policy "Public delete frames (Admin UI)"
  on public.frames for delete
  using (true);

create policy "Public read photos"
  on public.photos for select
  using (true);

create policy "Public insert photos"
  on public.photos for insert
  with check (true);

create policy "Public delete photos (Admin UI)"
  on public.photos for delete
  using (true);

-- 4. Storage Buckets (jalankan atau buat manual di menu Storage -> New Bucket, centang Public)
insert into storage.buckets (id, name, public)
values ('frames', 'frames', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- Kebijakan Storage agar publik bisa melihat & mengupload
create policy "Public read frames bucket"
  on storage.objects for select
  using (bucket_id = 'frames');

create policy "Public write frames bucket"
  on storage.objects for insert
  with check (bucket_id = 'frames');

create policy "Public delete frames bucket"
  on storage.objects for delete
  using (bucket_id = 'frames');

create policy "Public read gallery bucket"
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy "Public write gallery bucket"
  on storage.objects for insert
  with check (bucket_id = 'gallery');

create policy "Public delete gallery bucket"
  on storage.objects for delete
  using (bucket_id = 'gallery');
