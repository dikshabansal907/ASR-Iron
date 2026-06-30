-- Optional safety migration for Market page.
alter table public.rate_categories
add column if not exists previous_daily_rate numeric not null default 0;

alter table public.rate_categories
add column if not exists updated_at timestamptz not null default now();

update public.rate_categories
set previous_daily_rate = daily_rate
where previous_daily_rate is null or previous_daily_rate = 0;
