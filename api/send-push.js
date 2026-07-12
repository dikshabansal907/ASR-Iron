import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function buildQuery(client, target) {
  let query = client.from('push_subscriptions').select('*');
  if (!target || target === 'all') return query;
  if (target === 'admin') return query.eq('role', 'admin');
  if (target === 'salesman') return query.eq('role', 'salesman');
  if (target === 'fabricator') return query.eq('role', 'fabricator');
  if (String(target).startsWith('fabricator:')) return query.eq('user_id', String(target).replace('fabricator:', ''));
  return query.eq('role', target);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({
      error: 'Missing server environment variables. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.'
    });
  }

  const { target = 'all', title = 'ASR Iron', message = '', url = '/' } = req.body || {};
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: subscriptions, error } = await buildQuery(adminClient, target);
  if (error) return res.status(500).json({ error: error.message });

  const payload = JSON.stringify({
    title,
    body: message,
    url,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `asr-${Date.now()}`
  });

  let sent = 0;
  let failed = 0;

  await Promise.all((subscriptions || []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent += 1;
    } catch (err) {
      failed += 1;
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await adminClient.from('push_subscriptions').delete().eq('id', row.id);
      }
    }
  }));

  return res.status(200).json({ ok: true, sent, failed, target });
}
