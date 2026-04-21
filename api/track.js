// 原点智学 — 轻量自建事件采集 (edge)
// POST /api/track  { event, page, ts, sid, ref, meta }
// 不落库，写到 Vercel 函数日志 + 可选飞书告警关键事件

export const config = { runtime: 'edge' };

const KEY_EVENTS = new Set(['lead_submit', 'apikey_set', 'share_card']);
const MAX_STR = 200;
function clean(s) {
    return String(s || '').replace(/[<>"'&`]/g, '').slice(0, MAX_STR);
}

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json; charset=utf-8'
};

export default async function handler(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST')    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const evt = {
        event: clean(body.event),
        page:  clean(body.page),
        sid:   clean(body.sid),
        ref:   clean(body.ref),
        ua:    clean(req.headers.get('user-agent')),
        ip:    clean(req.headers.get('x-forwarded-for') || '').split(',')[0].trim(),
        ts:    Date.now(),
        meta:  body.meta && typeof body.meta === 'object' ? body.meta : {}
    };

    if (!evt.event) {
        return new Response(JSON.stringify({ error: 'missing_event' }), { status: 400, headers: CORS });
    }

    // 日志到 Vercel (可 tail)
    console.log('[track]', JSON.stringify(evt));

    // 关键事件 → 飞书
    if (KEY_EVENTS.has(evt.event) && process.env.FEISHU_WEBHOOK_URL) {
        const text = `🔔 关键事件\n事件: ${evt.event}\n页面: ${evt.page}\nsid: ${evt.sid}\n来源: ${evt.ref}\nmeta: ${JSON.stringify(evt.meta).slice(0, 300)}`;
        fetch(process.env.FEISHU_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg_type: 'text', content: { text } })
        }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
}
