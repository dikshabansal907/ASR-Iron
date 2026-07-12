import { createClient } from '@supabase/supabase-js';

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function requiredMissing(env) {
  return Object.entries(env)
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

function buildQuery(client, target) {
  let query = client.from('push_subscriptions').select('id,user_id,role,name,endpoint,subscription,updated_at');
  if (!target || target === 'all') return query;
  if (target === 'admin') return query.eq('role', 'admin');
  if (target === 'salesman') return query.eq('role', 'salesman');
  if (target === 'fabricator') return query.eq('role', 'fabricator');
  if (String(target).startsWith('fabricator:')) return query.eq('user_id', String(target).replace('fabricator:', ''));
  return query.eq('role', target);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
    }

    const env = {
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: process.env.VAPID_SUBJECT
    };

    const missing = requiredMissing(env);
    if (missing.length) {
      console.error('[send-push] Missing env variables:', missing.join(', '));
      return res.status(500).json({
        ok: false,
        error: 'Missing server environment variables.',
        missing
      });
    }

    let webpush;
    try {
      webpush = (await import('web-push')).default;
    } catch (err) {
      console.error('[send-push] web-push import failed:', err);
      return res.status(500).json({
        ok: false,
        error: 'web-push package is missing or could not be loaded. Run npm install web-push and deploy package-lock.json.',
        detail: err?.message || String(err)
      });
    }

    const body = parseBody(req);
    const target = body.target || 'all';
    const title = body.title || 'ASR Iron';
    const message = body.message || body.body || 'New ASR Iron notification';
    const url = body.url || '/';

    const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: subscriptions, error: subError } = await buildQuery(adminClient, target);
    if (subError) {
      console.error('[send-push] Supabase subscription query failed:', subError);
      return res.status(500).json({ ok: false, error: 'Supabase query failed.', detail: subError.message });
    }

    const rows = subscriptions || [];
    if (!rows.length) {
      console.warn('[send-push] No matching push subscriptions for target:', target);
      return res.status(200).json({ ok: true, target, matched: 0, sent: 0, failed: 0, message: 'No matching push subscriptions found.' });
    }

    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

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
    const failures = [];

    await Promise.all(rows.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload, { TTL: 60, urgency: 'high' });
        sent += 1;
      } catch (err) {
        failed += 1;
        failures.push({
          id: row.id,
          role: row.role,
          name: row.name,
          statusCode: err?.statusCode || null,
          message: err?.body || err?.message || String(err)
        });

        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await adminClient.from('push_subscriptions').delete().eq('id', row.id);
        }
      }
    }));

    console.log('[send-push] result:', JSON.stringify({ target, matched: rows.length, sent, failed }));

    return res.status(200).json({
      ok: true,
      target,
      matched: rows.length,
      sent,
      failed,
      failures: failures.slice(0, 5)
    });
  } catch (err) {
    console.error('[send-push] Unhandled error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Unhandled /api/send-push error.',
      detail: err?.message || String(err)
    });
  }
}
