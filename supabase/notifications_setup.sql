-- Notifications feature setup for ASR Iron
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  target text not null default 'all',
  title text not null,
  message text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_target_created_idx
on public.notifications (target, created_at desc);

-- For current custom-login MVP setup. If you later add Supabase Auth policies,
-- replace this with proper RLS policies.
alter table public.notifications disable row level security;
