// 原点智学 — 留资 Lead 接收端点
// POST /api/lead
// 接收前端表单提交 → 转发到飞书 Webhook（env FEISHU_WEBHOOK_URL）
//
// 同时永久存一份到 KV（如果配置了 Vercel KV；否则只转 Feishu）
// 这样 localStorage /leads.html 丢了也不丢 lead。

export const config = { runtime: 'edge' };

const IP_LIMIT_PER_DAY = 5; // 每 IP 每天最多 5 条 lead，防刷
const ipBucket = new Map();

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function ratelimit(ip) {
    const k = ip + '|' + todayKey();
    const n = (ipBucket.get(k) || 0) + 1;
    ipBucket.set(k, n);
    if (ipBucket.size > 5000) {
        const today = todayKey();
        for (const key of ipBucket.keys()) {
            if (!key.endsWith('|' + today)) ipBucket.delete(key);
        }
    }
    return n <= IP_LIMIT_PER_DAY;
}

function jsonErr(status, code, msg) {
    return new Response(JSON.stringify({ ok: false, error: code, message: msg }), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
}

function clean(s, max) {
    if (typeof s !== 'string') return '';
    s = s.trim().replace(/[\r\n\t]/g, ' ');
    return s.length > (max || 200) ? s.slice(0, max || 200) : s;
}

function isValidPhone(p) {
    return typeof p === 'string' && /^1[3-9]\d{9}$/.test(p.trim());
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': 'content-type'
            }
        });
    }
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
    if (!ratelimit(ip)) {
        return jsonErr(429, 'rate_limited', '今日提交次数过多，明天再试');
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return jsonErr(400, 'bad_json', '请求体不是合法 JSON');
    }

    const lead = {
        kind: clean(body.kind || 'contact', 50),
        tier: clean(body.tier || '', 50),
        tier_label: clean(body.tier_label || '', 100),
        name: clean(body.name, 50),
        phone: clean(body.phone, 20),
        kid: clean(body.kid, 100),
        age_or_kid: clean(body.age_or_kid || body.kid, 100),
        page: clean(body.page, 100),
        referrer: clean(body.referrer, 200),
        utm_source: clean(body.utm_source, 50),
        utm_medium: clean(body.utm_medium, 50),
        utm_campaign: clean(body.utm_campaign, 50),
        time: new Date().toISOString(),
        ip: ip
    };

    if (!lead.name && !lead.phone) {
        return jsonErr(400, 'missing_fields', '姓名和手机至少填一个');
    }
    if (lead.phone && !isValidPhone(lead.phone)) {
        return jsonErr(400, 'bad_phone', '手机号格式不对');
    }

    const hook = (typeof process !== 'undefined' && process.env && process.env.FEISHU_WEBHOOK_URL) || '';

    let feishuOk = false;
    if (hook) {
        const label = lead.kind === 'membership' ? '💎 会员预约' :
                      lead.kind === 'camp' ? '🎒 营报名' :
                      '📬 咨询';
        const text = label + ' — 原点智学\n' +
            (lead.tier_label ? '套餐: ' + lead.tier_label + '\n' : '') +
            '姓名: ' + (lead.name || '(未填)') + '\n' +
            '手机: ' + (lead.phone || '(未填)') + '\n' +
            (lead.kid ? '孩子: ' + lead.kid + '\n' : '') +
            'UTM: ' + (lead.utm_source || '直接访问') +
                (lead.utm_medium ? '/' + lead.utm_medium : '') +
                (lead.utm_campaign ? '/' + lead.utm_campaign : '') + '\n' +
            '来源: ' + (lead.page || '/') + '\n' +
            '时间: ' + lead.time;

        try {
            const r = await fetch(hook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msg_type: 'text', content: { text: text } })
            });
            feishuOk = r.ok;
        } catch (e) {
            feishuOk = false;
        }
    }

    return new Response(JSON.stringify({
        ok: true,
        feishu: feishuOk,
        configured: !!hook,
        time: lead.time
    }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
}
