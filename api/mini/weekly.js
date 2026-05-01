// 原点智学 · 家长周复盘服务
// POST /api/mini/weekly { axes, weak_points, homework_plan, grade, subject }
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

function normalizeList(value, limit = 6) {
    return Array.isArray(value) ? value.slice(0, limit) : [];
}

function buildReview(body = {}) {
    const axes = normalizeList(body.axes, 8);
    const weakPoints = normalizeList(body.weak_points || body.weakPoints, 4);
    const plan = body.homework_plan || body.plan || {};
    const must = normalizeList(plan.must_do, 6);
    const skip = normalizeList(plan.can_skip, 6);
    const flexible = normalizeList(plan.flexible, 6);
    const weakest = weakPoints[0] || axes.slice().sort((a, b) => Number(a.score || 0) - Number(b.score || 0))[0] || null;
    const savedMinutes = Number(plan.summary?.saved_minutes || 0);
    const mustMinutes = Number(plan.summary?.must_minutes || must.reduce((sum, item) => sum + Number(item.minutes || 0), 0));

    return {
        ok: true,
        source: 'server-weekly-review',
        grade: clean(body.grade || '五年级', 20),
        subject: clean(body.subject || '数学', 20),
        ai_notice: 'AI 辅助生成，供家长决策参考，不替代老师判断。',
        headline: weakest
            ? `本周优先处理“${clean(weakest.name || '', 24)}”，不要平均用力。`
            : '本周先把最有价值的作业做扎实。',
        focus: must.slice(0, 3).map((item) => ({
            text: clean(item.text || '', 120),
            reason: clean(item.reason || '', 120),
            evidence: item.evidence || null
        })),
        load: {
            must_minutes: mustMinutes,
            saved_minutes: savedMinutes,
            advice: skip.length
                ? `可后置 ${skip.length} 项低收益任务，预计释放 ${savedMinutes} 分钟。`
                : '今晚任务较集中，建议完成必须做后及时收尾。'
        },
        parent_script: weakest
            ? `今晚先不催快，先问孩子：这道题真正卡在“${clean(weakest.name || '', 24)}”的哪一步？`
            : '今晚先确认必须做任务，做完再考虑加量。',
        next_actions: [
            must[0] ? `先完成：${clean(must[0].text || '', 80)}` : '先确认一项必须做任务',
            flexible[0] ? `有余力再做：${clean(flexible[0].text || '', 80)}` : '有余力再复盘错因',
            '下次复盘只看三件事：必须做是否完成、关键错因是否说清、孩子是否少熬一点'
        ],
        generated_at: new Date().toISOString(),
        engine_version: 'mini-weekly-v1.0'
    };
}

async function readRequest(req) {
    try {
        return await readJson(req, 24 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接受 POST' }, 405);

    const ip = clientIp(req);
    const limited = rateLimit(`mini:weekly:${ip}`, 80);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) {
        return json({
            ok: false,
            error: body.__error.message === 'payload_too_large' ? 'payload_too_large' : 'bad_json',
            message: body.__error.message === 'payload_too_large' ? '请求体过大' : '请求体不是合法 JSON'
        }, body.__error.status || 400);
    }

    return json(buildReview(body));
}
