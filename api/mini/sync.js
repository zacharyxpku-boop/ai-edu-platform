import {
    clean,
    clientIp,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ENGINE_VERSION = 'mini-sync-v1.0';

function pgHeaders(extra = {}) {
    return {
        'content-type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        ...extra
    };
}

async function pgFetch(path, options = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...options,
        headers: pgHeaders(options.headers || {})
    });
}

function normalizeIdentity(identity = {}) {
    return {
        client_id: clean(identity.client_id || '', 120),
        user_id: clean(identity.user_id || '', 120),
        auth_mode: clean(identity.auth_mode || 'local', 20)
    };
}

function normalizeMutations(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 120).map((item) => ({
        mutation_id: clean(item.id || item.mutation_id || '', 120),
        mutation_type: clean(item.type || item.mutation_type || '', 80),
        payload: item.payload && typeof item.payload === 'object' ? item.payload : {},
        created_at: clean(item.created_at || '', 40),
        status: clean(item.status || 'pending', 20),
        client_id: clean(item.client_id || '', 120)
    })).filter((item) => item.mutation_id && item.mutation_type);
}

async function persistMutations(identity, mutations) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return {
            mode: 'stateless_ack',
            persisted: 0,
            pending: mutations.length,
            cursor: `local_${Date.now()}`
        };
    }
    const rows = mutations.map((item) => ({
        client_id: identity.client_id,
        user_id: identity.user_id || null,
        auth_mode: identity.auth_mode,
        mutation_id: item.mutation_id,
        mutation_type: item.mutation_type,
        payload: item.payload,
        mutation_created_at: item.created_at || new Date().toISOString(),
        mutation_status: item.status || 'pending',
        received_at: new Date().toISOString()
    }));
    const res = await pgFetch('/mini_sync_events?on_conflict=mutation_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(rows)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`sync_store_failed:${res.status}:${text.slice(0, 160)}`);
    }
    const data = await res.json();
    return {
        mode: 'supabase',
        persisted: Array.isArray(data) ? data.length : rows.length,
        pending: 0,
        cursor: `srv_${Date.now()}`
    };
}

async function readRequest(req) {
    try {
        return await readJson(req, 96 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: 'Only POST is allowed.' }, 405);

    const ip = clientIp(req);
    const limited = rateLimit(`mini:sync:${ip}`, 160);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: 'Too many requests.' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: 'Mini session is invalid.' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) {
        return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);
    }

    const identity = normalizeIdentity(body.identity || {});
    const mutations = normalizeMutations(body.mutations || []);
    if (!identity.client_id) return json({ ok: false, error: 'missing_client_id', message: 'Missing client identity.' }, 400);
    if (!mutations.length) return json({ ok: true, pushed: 0, pending: 0, cursor: body.cursor || '', mode: 'empty', engine_version: ENGINE_VERSION });

    try {
        const result = await persistMutations(identity, mutations);
        return json({
            ok: true,
            pushed: result.persisted,
            pending: result.pending,
            cursor: result.cursor,
            mode: result.mode,
            identity,
            acknowledged: mutations.map((item) => item.mutation_id),
            engine_version: ENGINE_VERSION
        });
    } catch (error) {
        return json({
            ok: false,
            error: 'sync_failed',
            message: error.message || 'sync_failed',
            pending: mutations.length,
            engine_version: ENGINE_VERSION
        }, 502);
    }
}
