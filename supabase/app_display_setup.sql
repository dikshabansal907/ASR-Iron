-- App opening banner and editable top line. Run once in Supabase SQL Editor.
create table if not exists public.app_display_settings (
  id boolean primary key default true,
  top_line text not null default 'Welcome to ASR Iron',
  banner_url text,
  updated_at timestamptz not null default now()
);

insert into public.app_display_settings (id, top_line)
values (true, 'Welcome to ASR Iron')
on conflict (id) do nothing;

alter table public.app_display_settings disable row level security;

insert into storage.buckets (id, name, public)
values ('app-media', 'app-media', true)
on conflict (id) do update set public = true;

drop policy if exists "app media public read" on storage.objects;
drop policy if exists "app media authenticated upload" on storage.objects;
drop policy if exists "app media anon upload" on storage.objects;
drop policy if exists "app media anon delete" on storage.objects;

create policy "app media public read"
on storage.objects for select
using (bucket_id = 'app-media');

create policy "app media anon upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'app-media');

create policy "app media anon delete"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'app-media');
