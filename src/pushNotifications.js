import { supabase } from './lib/supabaseClient';

export function isPushSupported() {
  return typeof window !== 'undefined' &&
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

function getPushApiUrl() {
  // Vite localhost does not serve Vercel /api routes.
  // For local testing, call the deployed Vercel API directly.
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocal) return 'https://asriron.vercel.app/api/send-push';
  return '/api/send-push';
}

export async function enablePushForUser(user, setToast = () => {}) {
  try {
    if (!isPushSupported()) {
      setToast('Phone push is not supported here. On iPhone, install/open the Home Screen app first.');
      return null;
    }

    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setToast('Missing VITE_VAPID_PUBLIC_KEY. Add it in Vercel and redeploy.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setToast('Notification permission was not allowed.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    if (!supabase) {
      setToast('Supabase is not connected. Cannot save phone subscription.');
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
      console.error('[push] subscription save failed', error);
      setToast(error.message || 'Could not save phone subscription.');
      return subscription;
    }

    setToast('Phone alerts enabled on this device.');
    return subscription;
  } catch (err) {
    console.error('[push] enable failed', err);
    setToast(err?.message || 'Could not enable phone alerts.');
    return null;
  }
}

export async function sendSystemPushNotification({ target = 'all', title, message, url = '/' }) {
  try {
    const response = await fetch(getPushApiUrl(), {
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
      console.warn('[push] send failed', response.status, data);
      return { ok: false, status: response.status, data };
    }

    return data || { ok: true };
  } catch (err) {
    console.warn('[push] send failed', err);
    return { ok: false, error: err?.message || String(err) };
  }
}
