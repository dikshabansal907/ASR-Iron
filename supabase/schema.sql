
-- ASR IRON Supabase Database Schema
-- Run this in Supabase SQL Editor once.

create extension if not exists pgcrypto;

do $$ begin
  create type approval_status as enum ('Pending','Approved','Rejected');
exception when duplicate_object then null; end $$;

create table if not exists fabricators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null unique,
  address text not null,
  password text not null,
  total_points numeric not null default 0,
  status approval_status not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists incentive_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'kg',
  points_per_unit numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  fabricator_id uuid not null references fabricators(id) on delete cascade,
  item_id uuid references incentive_items(id) on delete set null,
  item_name text not null,
  quantity numeric not null,
  unit text not null,
  points_earned numeric not null,
  status approval_status not null default 'Pending',
  submission_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists rate_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  daily_rate numeric not null default 0,
  freight numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists rate_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references rate_categories(id) on delete cascade,
  name text not null,
  fixed_difference numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(category_id, name)
);

create or replace function approve_submission(p_submission_id uuid)
returns void
language plpgsql
as $$
declare
  v_submission submissions%rowtype;
begin
  select * into v_submission from submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found';
  end if;
  if v_submission.status <> 'Pending' then
    return;
  end if;
  update submissions set status = 'Approved' where id = p_submission_id;
  update fabricators set total_points = total_points + v_submission.points_earned where id = v_submission.fabricator_id;
end;
$$;

create or replace function reject_submission(p_submission_id uuid)
returns void
language plpgsql
as $$
begin
  update submissions set status = 'Rejected' where id = p_submission_id and status = 'Pending';
end;
$$;

alter table fabricators disable row level security;
alter table incentive_items disable row level security;
alter table submissions disable row level security;
alter table rate_categories disable row level security;
alter table rate_items disable row level security;

insert into incentive_items (name, unit, points_per_unit) values
('Heavy Structural Fabrication','kg',3),
('Steel Window Frame Assembly','pcs',50),
('Stainless Handrails','ft',15),
('Iron Grill Work','pcs',80)
on conflict do nothing;

insert into fabricators (name, mobile, address, password, total_points, status) values
('Rajesh Welding Works','9876543210','Plot 45, Industrial Area Phase 1','password123',450,'Approved'),
('Sharma Steel & Fab','8765432109','Shop 12, Main Bazar Road','password123',120,'Approved'),
('Global Metal Crafters','7654321098','G-12, Sector 4 Extension','password123',850,'Approved')
on conflict (mobile) do nothing;

insert into rate_categories (name, daily_rate, freight) values
('Pipe',46.0,1.2),
('Angle',41.5,1.0),
('Flat',40.5,1.0),
('TMT',48.0,1.5)
on conflict (name) do update set daily_rate = excluded.daily_rate, freight = excluded.freight;

insert into rate_items (category_id, name, fixed_difference)
select c.id, v.name, v.fixed_difference
from rate_categories c
join (values
('Pipe','1" MS Round Pipe (Medium)',0.5),
('Pipe','2" Square GI Pipe (Heavy)',1.2),
('Pipe','0.5" MS Conduit Pipe',-0.2),
('Angle','25x25x3mm Steel Angle',0.0),
('Angle','50x50x5mm Structural Angle',0.8),
('Flat','25x5mm Mild Steel Flat Bar',-0.15),
('Flat','40x6mm Heavy Flat Bar',0.3),
('TMT','10mm Fe550 High-Strength TMT',0.45),
('TMT','16mm Premium TMT Reinforcement',0.95)
) as v(category_name, name, fixed_difference) on v.category_name = c.name
on conflict (category_id, name) do update set fixed_difference = excluded.fixed_difference;

insert into submissions (fabricator_id, item_id, item_name, quantity, unit, points_earned, status, submission_date)
select f.id, i.id, i.name, 50, i.unit, 250, 'Approved', date '2026-06-20'
from fabricators f, incentive_items i
where f.mobile = '9876543210' and i.name = 'Steel Window Frame Assembly'
on conflict do nothing;

insert into submissions (fabricator_id, item_id, item_name, quantity, unit, points_earned, status, submission_date)
select f.id, i.id, i.name, 2, i.unit, 160, 'Approved', date '2026-06-21'
from fabricators f, incentive_items i
where f.mobile = '9876543210' and i.name = 'Iron Grill Work'
on conflict do nothing;
