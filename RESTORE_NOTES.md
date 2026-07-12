# ASR Iron — Last Hosted Baseline

This folder was reconstructed from the files you shared as your last hosted ASR Iron version.

## Run
1. Create `.env.local` in the root if it is not already present.
2. Add your Supabase values:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_or_anon_key
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

## Folder mapping
- `App.jsx`, `main.jsx`, `styles.css` were placed under `src/`.
- `supabaseClient.js` was placed under `src/lib/`.
- `sw.js`, `asr-logo.png`, and `asr-logo-white.png` were placed under `public/`.
- `optional_sanity_setup.sql` was placed under `supabase/`.

This package is intended to be used as the baseline for future ASR Iron updates.
