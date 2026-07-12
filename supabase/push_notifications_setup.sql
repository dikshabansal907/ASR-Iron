-- ASR Iron WhatsApp-like Web Push setup
-- Run this in Supabase SQL Editor.

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

create index if not exists push_subscriptions_role_idx
on public.push_subscriptions (role);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions (user_id);

-- Existing in-app notifications table, included here for completeness.
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

-- Current custom-login MVP setup. If you later add Supabase Auth policies,
-- replace this with proper RLS policies.
alter table public.push_subscriptions disable row level security;
alter table public.notifications disable row level security;
