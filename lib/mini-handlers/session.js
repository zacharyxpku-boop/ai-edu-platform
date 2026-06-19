import {
  SESSION_MAX_AGE_MS,
  clean,
  clientRateKey,
  json,
  rateLimit,
  readJson,
  sessionSecret,
  signSession
} from '../mini-shared.js';
import { configured, nowIso, safeId, scrub, serviceContract, upsertRows } from '../mini-store.js';

async function sha256Short(value) {
  const text = String(value || '');
  if (!text || !globalThis.crypto?.subtle) return '';
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function exchangeWxCode(code, env) {
  const appid = env.WECHAT_APPID || env.MINIAPP_APP_ID || '';
  const secret = env.WECHAT_APP_SECRET || env.MINIAPP_APP_SECRET || '';
  if (!code || !appid || !secret) {
    return { ok: false, mode: 'not_configured', openid_hash: '', unionid_hash: '' };
  }
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appid);
  url.searchParams.set('secret', secret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');
  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errcode || !data.openid) {
    return { ok: false, mode: 'wechat_error', error_code: String(data.errcode || response.status), openid_hash: '', unionid_hash: '' };
  }
  return {
    ok: true,
    mode: 'wechat',
    openid_hash: await sha256Short(data.openid),
    unionid_hash: await sha256Short(data.unionid || '')
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'POST only' }, 405);

  const limited = rateLimit(clientRateKey(req, 'mini:session'), 80);
  if (!limited.ok) return json({ ok: false, error: 'rate_limited', resetAt: limited.resetAt }, 429);

  let body = {};
  try {
    body = await readJson(req, 8 * 1024);
  } catch (error) {
    return json({ ok: false, error: error.message || 'bad_json' }, error.status || 400);
  }

  const env = (typeof process !== 'undefined' && process.env) || {};
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const wx = await exchangeWxCode(clean(body.code || body.wx_code || '', 160), env);
  const userId = clean(body.user_id || '', 80) || (wx.openid_hash ? `wx_${wx.openid_hash}` : safeId('user'));
  const role = clean(body.role || body.profile?.role || 'parent', 20) || 'parent';
  const childId = clean(body.child_id || body.profile?.child_id || '', 80);
  const payload = {
    v: 2,
    mode: wx.ok ? 'wechat' : 'local',
    user_id: userId,
    child_id: childId,
    role,
    grade: clean(body?.profile?.grade || '', 20),
    exp: expiresAt
  };
  const sessionId = await signSession(payload, sessionSecret(env));
  const sessionRow = {
    session_id: sessionId,
    user_id: userId,
    openid_hash: wx.openid_hash || null,
    unionid_hash: wx.unionid_hash || null,
    client_id: clean(req.headers.get('x-mini-client') || body.client_id || '', 120) || null,
    role,
    child_id: childId || null,
    profile_snapshot: scrub(body.profile || {}),
    expires_at: new Date(expiresAt).toISOString(),
    created_at: nowIso()
  };
  const userRow = {
    user_id: userId,
    openid_hash: wx.openid_hash || null,
    unionid_hash: wx.unionid_hash || null,
    nickname: clean(body.profile?.nickname || '', 60) || null,
    avatar_url: clean(body.profile?.avatar_url || body.profile?.avatarUrl || '', 260) || null,
    active_role: role,
    updated_at: nowIso()
  };
  const userStore = await upsertRows('mini_users', userRow, 'user_id');
  const sessionStore = await upsertRows('mini_sessions', sessionRow, 'session_id');
  const persisted = Boolean(userStore.ok && sessionStore.ok);

  return json({
    ok: true,
    mode: wx.ok ? 'wechat' : 'local',
    service_ready: configured() && wx.ok,
    persisted,
    service_contract: {
      ...serviceContract('mini_sessions'),
      mode: wx.ok ? 'wechat_session' : 'local_session',
      evidence_required: ['wx_login_code'],
      action_required: wx.ok && configured() ? '' : 'wechat_or_database_configuration'
    },
    user_id: userId,
    role,
    child_id: childId,
    openid_hash: wx.openid_hash || '',
    session_id: sessionId,
    expires_at: new Date(expiresAt).toISOString(),
    persistence_warning: persisted ? '' : (userStore.error || sessionStore.error || ''),
    engine_version: 'mini-session-v2.1'
  });
}
