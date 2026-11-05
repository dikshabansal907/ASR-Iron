-- Repair permissions for the current custom-login app.
--
-- The frontend uses the Supabase anon key after authenticating in the app's
-- own tables. Supabase auth.uid() is therefore not available for these users.
-- Run this migration in the Supabase SQL editor to restore the current app
-- behavior. Replace this with Supabase Auth + role-based RLS before exposing
-- the database to untrusted clients.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.submissions
  to anon, authenticated;
grant select, insert, update, delete on table public.business_users
  to anon, authenticated;

-- The app reads fabricator totals after incentive approval. The approval RPC
-- performs the write as its owner rather than as the anon caller.
do $$
begin
  if to_regprocedure('public.approve_submission(uuid)') is not null then
    alter function public.approve_submission(uuid)
      security definer
      set search_path = public, pg_temp;
    grant execute on function public.approve_submission(uuid)
      to anon, authenticated;
  end if;
  if to_regprocedure('public.reject_submission(uuid)') is not null then
    alter function public.reject_submission(uuid)
      security definer
      set search_path = public, pg_temp;
    grant execute on function public.reject_submission(uuid)
      to anon, authenticated;
  end if;
end
$$;

-- These RPCs are used by the admin UI and were created for the custom-login
-- flow. Keep their table writes behind the functions where possible.
do $$
begin
  if to_regprocedure('public.approve_business(uuid)') is not null then
    grant execute on function public.approve_business(uuid)
      to anon, authenticated;
  end if;
  if to_regprocedure('public.reject_business(uuid)') is not null then
    grant execute on function public.reject_business(uuid)
      to anon, authenticated;
  end if;
  if to_regprocedure('public.set_business_margin(uuid,numeric)') is not null then
    grant execute on function public.set_business_margin(uuid, numeric)
      to anon, authenticated;
  end if;
end
$$;

-- Existing custom-login policies cannot use auth.uid(), so RLS would reject
-- these anon-key requests even when the table grants are present.
alter table public.submissions disable row level security;
alter table public.business_users disable row level security;