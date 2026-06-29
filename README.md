# FabriRewards — React + Supabase + Vercel

Production-ready conversion of the local-state FabriRewards prototype into a Vite React app backed by Supabase Auth, Postgres, RLS policies, and Vercel SPA deployment config.

## What changed from the prototype

- Auth moved from hardcoded credentials to Supabase Auth.
- Fabricators are stored in `profiles`. New signups are `pending` until an admin approves them.
- Eligible items are stored in `incentive_items`.
- Claims are stored in `submissions`.
- Admin actions update database records instead of React-only state.
- Row Level Security protects user/admin access.
- `vercel.json` supports direct refresh on React routes.

## Local setup

1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

4. Install and run:

```bash
npm install
npm run dev
```

5. Sign up one user from the app, then promote it to admin in Supabase SQL Editor:

```sql
update public.profiles p set role='admin', status='approved'
from auth.users u where p.id=u.id and u.email='YOUR_ADMIN_EMAIL@example.com';
```

## Vercel deployment

1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. Add environment variables in Vercel → Project Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy.

## Supabase Auth URL configuration

In Supabase Dashboard → Authentication → URL Configuration, add your Vercel production URL and preview URL pattern as allowed redirect URLs.

## Notes

This is a browser-only app using the publishable/anon client key. Do not put Supabase service role keys in Vite environment variables.
