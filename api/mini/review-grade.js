import {
    clean,
    clientRateKey,
    json,
    rateLimit,
    readJson,
    sessionSecret,
    verifySession
} from './_shared.js';
import { applySM2, calculateXP, getLevel } from './_game.js';

export const config = { runtime: 'edge' };

function normalizeGrade(value) {
    const text = clean(value || '', 20);
    if (['again', 'forgotten', '忘记'].includes(text)) return 'forgotten';
    if (['hard', 'fuzzy', '模糊'].includes(text)) return 'fuzzy';
    if (['easy', '会了'].includes(text)) return 'easy';
    return 'remembered';
}

async function readRequest(req) {
    try {
        return await readJson(req, 32 * 1024);
    } catch (error) {
        return { __error: error };
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', message: '只接收 POST 请求。' }, 405);

    const limited = rateLimit(clientRateKey(req, 'mini:review-grade'), 500);
    if (!limited.ok) return json({ ok: false, error: 'rate_limited', message: '请求过于频繁，请稍后再试。' }, 429);

    const env = (typeof process !== 'undefined' && process.env) || {};
    const sessionHeader = req.headers.get('x-mini-session') || '';
    if (sessionHeader) {
        const session = await verifySession(sessionHeader, sessionSecret(env));
        if (!session.ok) return json({ ok: false, error: 'bad_session', message: '小程序会话无效，请重新进入页面。' }, 401);
    }

    const body = await readRequest(req);
    if (body.__error) return json({ ok: false, error: body.__error.message || 'bad_json' }, body.__error.status || 400);

    const card = body.card || {};
    if (!card.id && !body.card_id) return json({ ok: false, error: 'missing_card_id', message: '缺少复习卡片标识。' }, 400);
    const grade = normalizeGrade(body.grade || body.rating);
    const schedule = applySM2(card, grade, new Date());
    const xpAction = grade === 'forgotten'
        ? 'review_again'
        : grade === 'fuzzy'
            ? 'review_fuzzy'
            : grade === 'easy'
                ? 'review_easy'
                : 'review_remembered';
    const xpDelta = calculateXP(xpAction, body.streak_multiplier || 1);
    const oldXp = Number(body.profile?.xp || body.xp || 0);
    const nextXp = oldXp + xpDelta;

    return json({
        ok: true,
        persisted: false,
        service_contract: {
            mode: 'request_card_only',
            evidence_required: ['card_id', 'grade'],
            action_required: 'account_service_configuration'
        },
        card_id: card.id || body.card_id,
        grade,
        schedule,
        xp_delta: xpDelta,
        xp: nextXp,
        level: getLevel(nextXp),
        event: {
            card_id: card.id || body.card_id,
            note_id: card.noteId || card.note_id || '',
            rating: grade,
            xp: xpDelta,
            subject: card.subject || '',
            weakPoint: card.weakPoint || '',
            created_at: new Date().toISOString()
        },
        engine_version: 'mini-game-review-grade-v1'
    });
}
