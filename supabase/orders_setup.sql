-- ASR Iron order workflow. Run once in Supabase SQL Editor.
create table if not exists public.order_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.order_firms(id) on delete set null,
  firm_name text not null,
  placed_by_id text,
  placed_by_name text,
  placed_by_role text not null default 'salesman',
  order_datetime timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending', 'Cancelled', 'Completed')),
  total numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  quote_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_firms_name_idx on public.order_firms (lower(name));
create index if not exists orders_datetime_idx on public.orders (order_datetime desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.order_firms disable row level security;
alter table public.orders disable row level security;

alter table public.orders add column if not exists quote_text text not null default '';
