
-- FabriRewards Supabase schema
-- Run this in Supabase SQL Editor before starting the app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  mobile text unique,
  workshop_address text,
  role text not null default 'fabricator' check (role in ('fabricator','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incentive_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('kg','pcs','ft')),
  points_per_unit integer not null check (points_per_unit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  fabricator_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.incentive_items(id),
  item_name text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  points_earned integer not null check (points_earned >= 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin' and status='approved');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, company_name, mobile, workshop_address, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'company_name', 'New Fabricator'),
    new.raw_user_meta_data->>'mobile',
    new.raw_user_meta_data->>'workshop_address',
    'fabricator',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.incentive_items enable row level security;
alter table public.submissions enable row level security;

-- Profiles
create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own_limited" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = 'fabricator');
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Items
create policy "items_read_all_authenticated" on public.incentive_items for select to authenticated using (active = true or public.is_admin());
create policy "items_admin_insert" on public.incentive_items for insert to authenticated with check (public.is_admin());
create policy "items_admin_update" on public.incentive_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "items_admin_delete" on public.incentive_items for delete to authenticated using (public.is_admin());

-- Submissions
create policy "submissions_select_own_or_admin" on public.submissions for select to authenticated using (fabricator_id = auth.uid() or public.is_admin());
create policy "submissions_insert_own_approved" on public.submissions for insert to authenticated with check (
  fabricator_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status='approved')
);
create policy "submissions_admin_update" on public.submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.incentive_items (name, unit, points_per_unit) values
('Heavy Duty MS Window Grills','kg',8),
('Stainless Steel Sliding Gate','pcs',150),
('Structural Truss Piping','ft',4),
('Sheet Metal Cladding Panels','pcs',45),
('Mild Steel Staircase Railings','ft',12)
on conflict do nothing;

-- After your first admin signs up, run this once with that user's email:
-- update public.profiles p set role='admin', status='approved'
-- from auth.users u where p.id=u.id and u.email='YOUR_ADMIN_EMAIL@example.com';
