alter table if exists public.rate_categories add column if not exists previous_daily_rate numeric not null default 0;
alter table if exists public.rate_categories add column if not exists updated_at timestamptz not null default now();
update public.rate_categories set previous_daily_rate = daily_rate where previous_daily_rate is null;
create unique index if not exists rate_items_category_name_unique on public.rate_items(category_id, name);
alter table if exists public.fabricators disable row level security;
alter table if exists public.incentive_items disable row level security;
alter table if exists public.submissions disable row level security;
alter table if exists public.rate_categories disable row level security;
alter table if exists public.rate_items disable row level security;
