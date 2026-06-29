
-- ASR Iron final image-matched Supabase schema support
-- Run this in Supabase SQL Editor. Safe to run multiple times.

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

create table if not exists public.material_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_rate_kg numeric not null default 0,
  freight_kg numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.material_specs (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.material_segments(id) on delete cascade,
  name text not null,
  diff_kg numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(segment_id, name)
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, company_name, mobile, workshop_address, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'company_name', 'New Fabricator'),
    new.raw_user_meta_data->>'mobile',
    new.raw_user_meta_data->>'workshop_address',
    'fabricator',
    'pending'
  )
  on conflict (id) do update set
    email = excluded.email,
    company_name = coalesce(public.profiles.company_name, excluded.company_name),
    mobile = coalesce(public.profiles.mobile, excluded.mobile),
    workshop_address = coalesce(public.profiles.workshop_address, excluded.workshop_address);
  return new;
end;
$$;

create or replace function public.get_auth_email_by_mobile(login_mobile text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where regexp_replace(coalesce(p.mobile, ''), '\D', '', 'g') = regexp_replace(coalesce(login_mobile, ''), '\D', '', 'g')
  limit 1;
$$;

grant execute on function public.get_auth_email_by_mobile(text) to anon, authenticated;

alter table public.material_segments enable row level security;
alter table public.material_specs enable row level security;
alter table public.redemption_requests enable row level security;

do $$ begin
  create policy "material_segments_read" on public.material_segments for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "material_segments_admin" on public.material_segments for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "material_specs_read" on public.material_specs for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "material_specs_admin" on public.material_specs for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "redemptions_select_own_or_admin" on public.redemption_requests for select to authenticated using (fabricator_id = auth.uid() or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "redemptions_insert_own" on public.redemption_requests for insert to authenticated with check (fabricator_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "redemptions_admin_update" on public.redemption_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

insert into public.material_segments (name, base_rate_kg, freight_kg) values
('Pipe Segment', 46, 1.2),
('Angle Segment', 50, 1.0),
('Flat Segment', 48, 1.1),
('HP Segment', 52, 1.5)
on conflict (name) do nothing;

insert into public.material_specs (segment_id, name, diff_kg)
select s.id, x.name, x.diff
from public.material_segments s
join (values
('Pipe Segment','1" MS Round Pipe (Medium)',0.5),
('Pipe Segment','2" Square GI Pipe (Heavy)',1.2),
('Pipe Segment','0.5" MS Conduit Pipe',-0.2),
('Angle Segment','25 X 3 Angle',0.4),
('Angle Segment','50 X 5 Angle',0.8),
('Flat Segment','25 X 5 Flat',0.3),
('Flat Segment','50 X 6 Flat',0.6),
('HP Segment','HP 100',1.0),
('HP Segment','HP 150',1.7)
) as x(segment_name,name,diff) on x.segment_name=s.name
on conflict do nothing;
