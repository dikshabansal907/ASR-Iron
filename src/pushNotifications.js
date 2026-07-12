import { supabase } from './lib/supabaseClient';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function enablePushForUser(user, showToast = () => {}) {
  if (!isPushSupported()) {
    showToast('Push notifications are not supported on this browser.', 'error');
    return null;
  }

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    showToast('Missing VITE_VAPID_PUBLIC_KEY in Vercel environment.', 'error');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    showToast('Notification permission was not allowed.', 'error');
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
    showToast('Supabase is not connected. Push subscription cannot be saved.', 'error');
    return subscription;
  }

  const role = String(user?.role || '').toLowerCase();
  const row = {
    user_id: user?.id || role,
    role,
    name: user?.name || role,
    endpoint: subscription.endpoint,
    subscription: subscription.toJSON(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
  if (error) {
    showToast(error.message || 'Could not save push subscription.', 'error');
    return subscription;
  }

  showToast('Phone notifications enabled for this device.');
  return subscription;
}

export async function sendSystemPushNotification({ target, title, message }) {
  const response = await fetch('/api/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, title, message, url: '/' })
  });
  return response.json();
}
