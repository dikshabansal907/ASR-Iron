
-- FabriRewards update: segments, rate master, final-rate calculator, redemption requests
-- Run this AFTER your original supabase/schema.sql.

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_categories (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid references public.segments(id) on delete set null,
  name text not null,
  daily_rate_per_kg numeric not null default 0,
  freight_per_kg numeric not null default 0,
  gst_percent numeric not null default 18,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(segment_id, name)
);

create table if not exists public.rate_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.rate_categories(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(category_id, name)
);

create table if not exists public.rate_item_sizes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.rate_items(id) on delete cascade,
  size_label text not null,
  fixed_difference_per_kg numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(item_id, size_label)
);

create table if not exists public.redemption_requests (
  id uuid primary key default gen_random_uuid(),
  fabricator_id uuid not null references public.profiles(id) on delete cascade,
  points_requested integer not null check (points_requested > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.segments enable row level security;
alter table public.rate_categories enable row level security;
alter table public.rate_items enable row level security;
alter table public.rate_item_sizes enable row level security;
alter table public.redemption_requests enable row level security;

-- Read access for authenticated users; write access for admin.
do $$ begin
  create policy "segments_read" on public.segments for select to authenticated using (active = true or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "segments_admin_write" on public.segments for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "categories_read" on public.rate_categories for select to authenticated using (active = true or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "categories_admin_write" on public.rate_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "items_read" on public.rate_items for select to authenticated using (active = true or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "items_admin_write" on public.rate_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "sizes_read" on public.rate_item_sizes for select to authenticated using (active = true or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "sizes_admin_write" on public.rate_item_sizes for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

-- Redemption: fabricator can create/read own; admin can manage all.
do $$ begin
  create policy "redemptions_select_own_or_admin" on public.redemption_requests for select to authenticated using (fabricator_id = auth.uid() or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "redemptions_insert_own" on public.redemption_requests for insert to authenticated with check (fabricator_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "redemptions_admin_update" on public.redemption_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

-- Seed base segments/categories/items/sizes. Rates are PER KG.
insert into public.segments(name) values ('STRUCTURAL'), ('TMT'), ('SHEET') on conflict do nothing;

insert into public.rate_categories(segment_id, name, daily_rate_per_kg, freight_per_kg, gst_percent)
select s.id, x.name, x.rate, x.freight, 18
from public.segments s
join (values
  ('STRUCTURAL','Pipe',40,1.2),
  ('STRUCTURAL','Angle',41.5,1.1),
  ('STRUCTURAL','Flat',40.5,1.0),
  ('TMT','TMT',48,1.5)
) as x(segment_name,name,rate,freight) on x.segment_name=s.name
on conflict do nothing;

insert into public.rate_items(category_id, name)
select c.id, x.item_name
from public.rate_categories c
join (values
  ('Pipe','MS Round Pipe'),
  ('Pipe','GI Pipe'),
  ('Angle','MS Angle'),
  ('Flat','MS Flat'),
  ('TMT','TMT Bar')
) as x(category_name,item_name) on x.category_name=c.name
on conflict do nothing;

insert into public.rate_item_sizes(item_id, size_label, fixed_difference_per_kg)
select i.id, x.size_label, x.diff
from public.rate_items i
join public.rate_categories c on c.id=i.category_id
join (values
  ('MS Round Pipe','1 inch',0.8),
  ('MS Round Pipe','2 inch',1.2),
  ('GI Pipe','1 inch',1.5),
  ('MS Angle','25x25x3 mm',0.7),
  ('MS Angle','35x35x5 mm',1.1),
  ('MS Flat','25x5 mm',0.5),
  ('MS Flat','50x6 mm',0.9),
  ('TMT Bar','8 mm',0.6),
  ('TMT Bar','10 mm',0.8),
  ('TMT Bar','12 mm',1.0)
) as x(item_name,size_label,diff) on x.item_name=i.name
on conflict do nothing;
