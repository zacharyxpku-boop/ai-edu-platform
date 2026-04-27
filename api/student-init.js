// 原点智学 · 学生首次诊断初始化
// POST /api/student-init
// Body: { name, grade, stage, subjects[], goals?, cohort? }
// → { student_id, recommended_first_topic, system_message }
//
// 用途：5.5 家长扫码进 onboarding 第一步，识别孩子年级 + 学科 + 起步知识点
// 后续：mastery-loop?student_id=xxx&topic=recommended_first_topic 自动跳到对的题

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_URL : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const ENGINE_VERSION = 'student-init-v1.0';

// 默认推荐起点（按年级 → 该年级第一章第一个 KP）
const DEFAULT_FIRST_TOPIC = {
    middle_1: 'math.7.ch3.kp3',  // 一元一次方程·移项（最高频考点）
    middle_2: 'math.8.ch11.kp3', // 全等三角形判定
    middle_3: 'math.9.ch21.kp3', // 一元二次方程·配方法
    primary_5: 'math.5.ch1.kp1', // 占位（小学未做完）
    primary_6: 'math.6.ch1.kp1',
    high_1: 'math.h.func_concept',
    high_2: 'math.h.deriv',
    high_3: 'math.h.deriv',
};

const VALID_GRADES = new Set(Object.keys(DEFAULT_FIRST_TOPIC));
const VALID_STAGES = new Set(['primary', 'middle', 'high']);
const VALID_SUBJECTS = new Set(['math', 'physics', 'chemistry', 'biology', 'chinese', 'english', 'history', 'geography', 'politics']);

function jsonErr(s, c, m) {
    return new Response(JSON.stringify({ ok: false, error: c, message: m }), {
        status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonErr(503, 'not_configured', 'Supabase env 未配');
    }

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { name, grade, stage = 'middle', subjects = ['math'], goals = {}, cohort } = body || {};
    if (!name || !grade) return jsonErr(400, 'missing_fields', 'name + grade 必填');
    if (!VALID_GRADES.has(grade)) return jsonErr(400, 'bad_grade', `grade 必须是 ${[...VALID_GRADES].join('|')}`);
    if (!VALID_STAGES.has(stage)) return jsonErr(400, 'bad_stage', `stage 必须是 ${[...VALID_STAGES].join('|')}`);
    const validSubs = subjects.filter(s => VALID_SUBJECTS.has(s));
    if (!validSubs.length) return jsonErr(400, 'bad_subjects', `subjects 至少 1 个合法学科`);

    // 创建 student
    let student_id;
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                'Prefer': 'return=representation',
            },
            body: JSON.stringify({
                name: String(name).slice(0, 50),
                grade,
                stage,
                subjects: validSubs,
                goals,
                cohort: cohort || null,
            }),
        });
        if (!r.ok) {
            const text = await r.text();
            return jsonErr(502, 'create_student_failed', `Supabase ${r.status}: ${text.slice(0, 200)}`);
        }
        const data = await r.json();
        student_id = Array.isArray(data) ? data[0]?.id : data?.id;
    } catch (e) {
        return jsonErr(502, 'upstream_unreachable', `Supabase 不可达: ${e.message}`);
    }

    const recommended_first_topic = DEFAULT_FIRST_TOPIC[grade];

    return new Response(JSON.stringify({
        ok: true,
        student_id,
        name,
        grade,
        stage,
        subjects: validSubs,
        recommended_first_topic,
        next_url: `/mastery-loop?student_id=${student_id}&name=${encodeURIComponent(name)}&topic=${encodeURIComponent(recommended_first_topic)}`,
        system_message: `欢迎${name}！我们从「${recommended_first_topic.split('.').pop()}」开始，25 分钟看你的状态。`,
        engine_version: ENGINE_VERSION,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}
