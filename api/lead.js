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

    // 通道开关 (从 env 读)
    const env = (typeof process !== 'undefined' && process.env) || {};
    const feishuHook = env.FEISHU_WEBHOOK_URL || '';
    const wecomHook = env.WECOM_WEBHOOK_URL || '';      // 企业微信群机器人
    const resendKey = env.RESEND_API_KEY || '';
    const notifyEmail = env.LEAD_NOTIFY_EMAIL || 'zachary.x.pku@gmail.com';
    const fromEmail = env.LEAD_FROM_EMAIL || 'leads@yuandianzhixue.com';

    const label = lead.kind === 'membership' ? '会员预约' :
                  lead.kind === 'camp' ? '少年营报名' :
                  lead.kind === 'wechat-cta' ? '微信咨询' :
                  '咨询';
    const channelName = lead.channel_label || lead.tier_label || '';

    const summary =
        '【' + label + '】 ' + (channelName || '原点智学') + '\n' +
        '姓名: ' + (lead.name || '(未填)') + '\n' +
        '手机: ' + (lead.phone || '(未填)') + '\n' +
        (lead.kid ? '孩子: ' + lead.kid + '\n' : '') +
        'UTM: ' + (lead.utm_source || '直接访问') +
            (lead.utm_medium ? '/' + lead.utm_medium : '') +
            (lead.utm_campaign ? '/' + lead.utm_campaign : '') + '\n' +
        '来源页: ' + (lead.page || '/') + '\n' +
        (lead.referrer ? '上页: ' + lead.referrer + '\n' : '') +
        '时间: ' + lead.time + '\n' +
        'IP: ' + lead.ip;

    const channels = { feishu: false, wecom: false, email: false };

    // 通道 1: 飞书自定义机器人
    if (feishuHook) {
        try {
            const r = await fetch(feishuHook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msg_type: 'text', content: { text: summary } })
            });
            channels.feishu = r.ok;
        } catch (e) { /* swallow */ }
    }

    // 通道 2: 企业微信群机器人
    if (wecomHook) {
        try {
            const r = await fetch(wecomHook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msgtype: 'text', text: { content: summary } })
            });
            channels.wecom = r.ok;
        } catch (e) { /* swallow */ }
    }

    // 通道 3: Resend 邮件 (最低门槛, 5 分钟开账号即可)
    if (resendKey) {
        try {
            const subject = '【原点智学 lead】' + label + ' · ' + (lead.name || '匿名') + ' · ' + (lead.phone || '无电话');
            const html =
                '<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:auto;padding:24px;background:#FAF7F0;border-radius:8px">' +
                '<h2 style="font-size:18px;color:#0F4F3D;margin:0 0 14px;border-bottom:2px solid #0F4F3D;padding-bottom:8px">' + label + ' · ' + (channelName || '原点智学') + '</h2>' +
                '<table style="width:100%;border-collapse:collapse;font-size:14px;color:#1A1A1A">' +
                '<tr><td style="padding:8px 0;color:#666;width:80px">姓名</td><td style="padding:8px 0;font-weight:500">' + (lead.name || '<i style="color:#999">未填</i>') + '</td></tr>' +
                '<tr><td style="padding:8px 0;color:#666">手机</td><td style="padding:8px 0;font-weight:500"><a href="tel:' + (lead.phone || '') + '" style="color:#0F4F3D">' + (lead.phone || '<i style="color:#999">未填</i>') + '</a></td></tr>' +
                (lead.kid ? '<tr><td style="padding:8px 0;color:#666">孩子</td><td style="padding:8px 0">' + lead.kid + '</td></tr>' : '') +
                '<tr><td style="padding:8px 0;color:#666">来源</td><td style="padding:8px 0;font-family:monospace;font-size:12px">' + (lead.page || '/') + '</td></tr>' +
                (lead.utm_source ? '<tr><td style="padding:8px 0;color:#666">UTM</td><td style="padding:8px 0;font-family:monospace;font-size:12px">' + lead.utm_source + (lead.utm_medium ? '/' + lead.utm_medium : '') + (lead.utm_campaign ? '/' + lead.utm_campaign : '') + '</td></tr>' : '') +
                '<tr><td style="padding:8px 0;color:#666">时间</td><td style="padding:8px 0;font-family:monospace;font-size:12px">' + lead.time + '</td></tr>' +
                '<tr><td style="padding:8px 0;color:#666">IP</td><td style="padding:8px 0;font-family:monospace;font-size:12px;color:#999">' + lead.ip + '</td></tr>' +
                '</table>' +
                '<div style="margin-top:18px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.08);font-size:12px;color:#999;line-height:1.7">原点智学 lead 自动通知 · 24h 内回 lead</div>' +
                '</div>';
            const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + resendKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: '原点智学 Lead <' + fromEmail + '>',
                    to: [notifyEmail],
                    subject: subject,
                    html: html,
                    text: summary
                })
            });
            channels.email = r.ok;
        } catch (e) { /* swallow */ }
    }

    return new Response(JSON.stringify({
        ok: true,
        channels: channels,
        configured: {
            feishu: !!feishuHook,
            wecom: !!wecomHook,
            email: !!resendKey
        },
        time: lead.time
    }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
}
