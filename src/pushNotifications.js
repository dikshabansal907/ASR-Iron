import { supabase } from './lib/supabaseClient';

function notify(setToast, message) {
  try {
    if (typeof setToast === 'function') setToast(message);
  } catch {}
  // On some mobile layouts the toast may be hidden/cached; console keeps the exact reason visible in remote debugging.
  console.log('[ASR Push]', message);
}

export function isPushSupported() {
  return typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

export function getPushPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function ensureServiceWorker(setToast) {
  if (!('serviceWorker' in navigator)) {
    notify(setToast, 'Service worker is not supported on this browser.');
    return null;
  }

  try {
    // If already registered, this will resolve quickly. If not, it registers /sw.js from public/sw.js.
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error('[ASR Push] Service worker registration failed', err);
    notify(setToast, `Service worker failed: ${err?.message || 'unknown error'}`);
    return null;
  }
}

export async function enablePushForUser(user, setToast = () => {}) {
  try {
    if (typeof window === 'undefined') return null;

    if (!window.isSecureContext) {
      notify(setToast, 'Phone alerts need HTTPS. Open the hosted Vercel app, not local/in-app browser.');
      return null;
    }

    if (!('Notification' in window)) {
      notify(setToast, 'This browser does not support notification permission. On iPhone, add ASR Iron to Home Screen and open from the app icon.');
      return null;
    }

    if (!('PushManager' in window)) {
      notify(setToast, 'PushManager is not available. On iPhone, open the installed Home Screen app.');
      return null;
    }

    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      notify(setToast, 'Missing VITE_VAPID_PUBLIC_KEY. Add it in Vercel and redeploy.');
      return null;
    }

    const registration = await ensureServiceWorker(setToast);
    if (!registration) return null;

    let permission = Notification.permission;
    if (permission === 'default') {
      // Must be called directly from the button tap/click handler.
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied') {
      notify(setToast, 'Notifications are blocked. Enable them from phone browser/app notification settings.');
      return null;
    }

    if (permission !== 'granted') {
      notify(setToast, `Notification permission is ${permission}.`);
      return null;
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    if (!supabase) {
      notify(setToast, 'Supabase is not connected. Cannot save phone subscription.');
      return subscription;
    }

    const role = String(user?.role || 'unknown').toLowerCase();
    const row = {
      user_id: String(user?.id || role),
      role,
      name: user?.name || role,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' });

    if (error) {
      console.error('[ASR Push] Supabase subscription save failed', error);
      notify(setToast, error.message || 'Could not save phone subscription.');
      return subscription;
    }

    notify(setToast, 'Phone alerts enabled on this device.');
    return subscription;
  } catch (err) {
    console.error('[ASR Push] Enable failed', err);
    notify(setToast, err?.message || 'Could not enable phone alerts.');
    return null;
  }
}

export async function sendSystemPushNotification({ target = 'all', title, message, url = '/' }) {
  try {
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, title, message, url })
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      console.warn('[ASR Push] send failed', response.status, data);
      return { ok: false, status: response.status, data };
    }

    return data || { ok: true };
  } catch (err) {
    console.warn('[ASR Push] send failed', err);
    return { ok: false, error: err?.message || String(err) };
  }
}
