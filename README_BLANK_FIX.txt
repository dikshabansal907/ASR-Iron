Blank screen fix for ASR Iron hosted baseline.

Replace these files:
- src/App.jsx
- src/lib/supabaseClient.js
- postcss.config.js
- tailwind.config.js

Then stop and restart Vite:
Ctrl + C
npm run dev

If still blank, clear Vite cache:
rmdir /s /q node_modules\.vite
npm run dev

If browser still shows blank because of service worker cache, open DevTools Console and run:
navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))).then(() => location.reload());

Also ensure .env.local exists in project root:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key

This fix prevents the app from crashing to a blank page when Supabase env vars are missing.
