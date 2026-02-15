-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Photos Table
create table if not exists public.photos (
  id uuid default uuid_generate_v4() primary key,
  storage_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.photos enable row level security;

create policy "Photos are viewable by everyone"
  on public.photos for select
  using ( true );

create policy "Anyone can upload photos"
  on public.photos for insert
  with check ( true );

-- 2. Templates Table
create table if not exists public.templates (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  preview_url text not null,
  overlay_url text not null,
  category text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.templates enable row level security;

create policy "Templates are viewable by everyone"
  on public.templates for select
  using ( true );

-- 3. Sessions (or Events) Table - we'll call it 'events' as per new plan
create table if not exists public.events (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique,
  date date not null,
  description text,
  is_active boolean default true,
  config jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.events enable row level security;

create policy "Public events are viewable by everyone"
  on public.events for select
  using ( true );

create policy "Anyone can insert events"
  on public.events for insert
  with check ( true );

create policy "Anyone can update events"
  on public.events for update
  using ( true )
  with check ( true );

create policy "Anyone can delete events"
  on public.events for delete
  using ( true );

-- 4. Storage Buckets (Note: SQL execution might fail if buckets already exist, so check manually)
insert into storage.buckets (id, name, public) 
values ('photos', 'photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('templates', 'templates', true)
on conflict (id) do nothing;

-- 5. Storage Policies
create policy "Public Access to Photos"
  on storage.objects for select
  using ( bucket_id = 'photos' );

create policy "Anyone can upload photos"
  on storage.objects for insert
  with check ( bucket_id = 'photos' );

create policy "Public Access to Templates"
  on storage.objects for select
  using ( bucket_id = 'templates' );

create policy "Admins can upload templates"
  on storage.objects for insert
  with check ( bucket_id = 'templates' and auth.role() = 'authenticated' );
