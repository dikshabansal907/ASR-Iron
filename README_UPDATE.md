# FabriRewards Update Pack — Daily Rates + Segments + Redeem

This update adds:

1. Fabricator dashboard item dropdown starts blank.
2. Fabricator Redeem Points button and redemption request history.
3. Admin redemption approval/rejection.
4. Admin Daily Rate Update page.
5. Segments, categories, items, sizes, fixed difference, freight, GST.
6. Final Rate Calculator page.
7. Rates are stored per kg, not per MT.

## Apply Steps

1. In Supabase SQL Editor, run:
   `supabase/update_rate_redeem_schema.sql`

2. Replace your local file:
   `src/App.jsx`
   with the included `src/App.jsx`.

3. Run locally:
   `npm run dev`

4. Check:
   - Fabricator item dropdown starts as "Select item".
   - Fabricator has Redeem Points section.
   - Admin panel has tabs: Redeem, Daily Rate Update, Final Rate.

5. Upload changed files to GitHub:
   - `src/App.jsx`
   - `supabase/update_rate_redeem_schema.sql`

6. Vercel redeploys automatically.
