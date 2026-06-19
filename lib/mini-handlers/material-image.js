import { clean, json, readJson, clientRateKey, rateLimit, sessionSecret, verifySession } from '../mini-shared.js';
import { insertRows, nowIso, safeId, scrub, serviceContract } from '../mini-store.js';

const SUPABASE_URL = (typeof process !== 'undefined' && process.env)
  ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
  : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env)
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : '';
const BUCKET = 'materials';
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function safeExt(value) {
  const ext = String(value || 'jpg').toLowerCase().replace(/[^a-z]/g, '');
  return ALLOWED_EXT[ext] ? ext : 'jpg';
}

function bytesFromBase64(base64) {
  const binary = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:material-image'), 40);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 2 * 1024 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const base64 = String(body.image_base64 || '').replace(/^data:[^,]+,/, '');
  if (!base64 || base64.length < 64) {
    return json({ ok: false, error: 'missing_image', message: 'image_base64 required' }, 400);
  }

  let bytes;
  try {
    bytes = bytesFromBase64(base64);
  } catch (error) {
    return json({ ok: false, error: 'bad_base64', message: 'invalid image encoding' }, 400);
  }
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    return json({ ok: false, error: 'image_too_large', message: 'image exceeds 1.5MB' }, 413);
  }

  const ext = safeExt(body.ext);
  const materialType = String(body.material_type || 'material').replace(/[^a-z_]/g, '').slice(0, 24) || 'material';
  const day = new Date().toISOString().slice(0, 10);
  const objectPath = `mini/${day}/${materialType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const env = (typeof process !== 'undefined' && process.env) || {};
  const session = await verifySession(req.headers.get('x-mini-session') || '', sessionSecret(env));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({
      ok: true,
      stored: 'local_only',
      persisted: false,
      path: '',
      message: 'storage not configured',
      service_contract: serviceContract('mini_materials')
    });
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'content-type': ALLOWED_EXT[ext],
        'x-upsert': 'false'
      },
      body: bytes
    });
    if (!upstream.ok) {
      return json({ ok: false, error: 'storage_upstream_error', upstream_status: upstream.status, message: 'storage unavailable' }, 502);
    }
    const materialId = safeId('mat');
    const stored = await insertRows('mini_materials', {
      material_id: materialId,
      session_id: clean(req.headers.get('x-mini-session') || '', 180) || null,
      user_id: session.ok ? clean(session.payload?.user_id || '', 100) || null : null,
      child_id: clean(body.child_id || body.student_id || session.payload?.child_id || '', 100) || null,
      material_type: materialType,
      storage_bucket: BUCKET,
      storage_path: objectPath,
      status: 'uploaded',
      metadata: scrub({
        ext,
        bytes: bytes.length,
        source: body.source || '',
        requires_parent_confirmation: true
      }),
      created_at: nowIso()
    }, 'return=representation');
    return json({
      ok: true,
      stored: 'supabase',
      persisted: Boolean(stored.ok),
      material_id: materialId,
      bucket: BUCKET,
      path: objectPath,
      service_contract: serviceContract('mini_materials'),
      persistence_warning: stored.ok ? '' : stored.error || ''
    });
  } catch (error) {
    return json({ ok: false, error: 'storage_unreachable', message: 'storage unreachable' }, 502);
  }
}
