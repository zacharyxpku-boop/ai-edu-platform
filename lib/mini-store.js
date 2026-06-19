import { env } from './env.js';
import { clean } from './mini-shared.js';

// All Supabase writes in mini handlers use SUPABASE_SERVICE_ROLE_KEY through env.supabaseServiceRoleKey().
const SENSITIVE_KEY = /answer|phone|mobile|openid|unionid|token|secret|session|password|authorization|credential|key/i;

function configured() {
  return Boolean(env.supabaseUrl() && env.supabaseServiceRoleKey());
}

function nowIso() {
  return new Date().toISOString();
}

async function hashShort(value) {
  const text = String(value || '');
  if (!text || !globalThis.crypto?.subtle) return '';
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function safeId(prefix = 'id') {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function scrub(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') return clean(value, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => scrub(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 60).map(([key, item]) => {
      const safeKey = clean(key, 80);
      return [safeKey, SENSITIVE_KEY.test(safeKey) ? '[redacted]' : scrub(item, depth + 1)];
    }));
  }
  return clean(String(value), 200);
}

function pgHeaders(extra = {}) {
  const serviceKey = env.supabaseServiceRoleKey();
  return {
    'content-type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra
  };
}

async function request(table, query = '', options = {}) {
  if (!configured()) {
    return { ok: false, configured: false, status: 0, data: null, error: 'service_configuration' };
  }
  const url = `${env.supabaseUrl().replace(/\/$/, '')}/rest/v1/${table}${query}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: pgHeaders(options.headers || {}),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }
  return {
    ok: response.ok,
    configured: true,
    status: response.status,
    data,
    error: response.ok ? '' : clean(String(text || response.statusText), 240)
  };
}

async function insertRows(table, rows, prefer = 'return=representation') {
  const payload = Array.isArray(rows) ? rows : [rows];
  return request(table, '', {
    method: 'POST',
    headers: { Prefer: prefer },
    body: payload
  });
}

async function upsertRows(table, rows, conflictKey) {
  const query = conflictKey ? `?on_conflict=${encodeURIComponent(conflictKey)}` : '';
  return request(table, query, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: Array.isArray(rows) ? rows : [rows]
  });
}

async function selectRows(table, query) {
  return request(table, query, { method: 'GET' });
}

function requireAdmin(req) {
  const expected = env.adminToken();
  if (!expected) return { ok: false, status: 503, error: 'admin_token_not_configured' };
  const token = req.headers.get('x-admin-token') || req.headers.get('X-Admin-Token') || '';
  if (token !== expected) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true };
}

function serviceContract(table, actionRequired = 'service_configuration') {
  return {
    table,
    persisted_by: 'supabase_service_role',
    client_access: 'forbidden_by_rls',
    action_required: configured() ? '' : actionRequired
  };
}

export {
  configured,
  hashShort,
  insertRows,
  nowIso,
  requireAdmin,
  safeId,
  scrub,
  selectRows,
  serviceContract,
  upsertRows
};
