-- ASR Iron push notification permissions for current custom-login MVP
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  target text not null default 'all',
  title text not null,
  message text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  role text not null,
  name text,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_target_created_idx on public.notifications (target, created_at desc);
create index if not exists push_subscriptions_role_idx on public.push_subscriptions (role);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.notifications to anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to anon, authenticated;

alter table public.notifications disable row level security;
alter table public.push_subscriptions disable row level security;
