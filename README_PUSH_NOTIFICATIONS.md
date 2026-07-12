# ASR Iron WhatsApp-like Phone Push Notifications

This package adds the infrastructure for real phone notification tray alerts, similar to WhatsApp-style notifications.

## What this adds

- `public/sw.js` with real `push` event handling.
- `src/pushNotifications.js` to request permission and save the browser/device subscription.
- `api/send-push.js` Vercel serverless API to send push messages to subscribed devices.
- `supabase/push_notifications_setup.sql` to create `push_subscriptions` and `notifications` tables.
- `package.json` with `web-push` dependency.
- `src/App_PUSH_SNIPPETS.jsx` with exact integration snippets for your current `App.jsx`.

## Required Vercel Environment Variables

Add these in Vercel Project Settings > Environment Variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@example.com
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

Keep `SUPABASE_SERVICE_ROLE_KEY` private. Do not put it in frontend code.

## Generate VAPID keys

Run locally:

```bash
npm install web-push
npx web-push generate-vapid-keys
```

Copy the public/private keys into Vercel environment variables.

## Supabase SQL

Run this file in Supabase SQL Editor:

```txt
supabase/push_notifications_setup.sql
```

## iPhone important note

For iPhone, Web Push works only for installed Home Screen web apps on supported iOS versions. User flow:

1. Open your Vercel website in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Open ASR Iron from the new Home Screen icon.
5. Tap Enable Phone Notifications inside the app.
6. Allow notifications.

## Android/Chrome flow

1. Open hosted Vercel app.
2. Install app or open it in Chrome.
3. Tap Enable Phone Notifications.
4. Allow notifications.

## Current limitation

This package includes the backend and helper files. You still need to merge the snippets in `src/App_PUSH_SNIPPETS.jsx` into your current working `src/App.jsx`, because your App.jsx has been changing and I should not overwrite your working hosted baseline blindly.
