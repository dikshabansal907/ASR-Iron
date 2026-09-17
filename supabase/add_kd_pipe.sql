-- Add KD PIPE with the same sizes/specifications as PIPE.
-- Run once in the Supabase SQL Editor. Safe to run again.

insert into public.rate_categories (
  name,
  daily_rate,
  previous_daily_rate,
  freight,
  updated_at
)
select
  'KD PIPE',
  source.daily_rate,
  source.previous_daily_rate,
  source.freight,
  source.updated_at
from public.rate_categories source
where lower(source.name) = 'pipe'
on conflict (name) do nothing;

insert into public.rate_items (category_id, name, fixed_difference)
select
  kd.id,
  source_item.name,
  source_item.fixed_difference
from public.rate_items source_item
join public.rate_categories source
  on source.id = source_item.category_id
join public.rate_categories kd
  on lower(kd.name) = 'kd pipe'
where lower(source.name) = 'pipe'
on conflict (category_id, name) do nothing;
