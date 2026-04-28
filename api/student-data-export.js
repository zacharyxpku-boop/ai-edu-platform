// 原点智学 · /api/student-data-export · 学生数据导出端点
//
// 法律基础：PIPL 第 45 条（查阅、复制权）
//
// 用法：
//   GET /api/student-data-export?student_id=<uuid>&token=<recover_code_uppercase>
//
// 鉴权：当前 PoC 期使用「找回码」轻鉴权（student_id 末 6 位大写）
//        正式版应替换为 Supabase Auth JWT 校验 + 监护人复签
//
// 速率限制：单 student_id 每 24 小时 5 次（防爬库）
//
// 返回：JSON 格式数据包，包含：
//   - profile          学生基本档案（students 表）
//   - dialogues        对话记录（去敏感字段：embedding 不导出）
//   - attempts         作答记录
//   - escalations      学长转交记录
//   - student_states   知识点掌握度
//   - parent_pushes    家长简报（如有）
//   - moderation_logs  内容审核日志（仅 verdict ≠ clean 的）
//   - export_meta      导出元数据
//
// 响应 header：Content-Disposition: attachment; filename="export-<student_id>-<date>.json"

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env)
    ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
    : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env)
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 单 student_id 24h 限 5 次
const RATE_LIMIT_PER_DAY = 5;
const rateBucket = new Map();
function checkRateLimit(studentId) {
    const today = Math.floor(Date.now() / 86400000);
    const k = `${studentId}|${today}`;
    const n = (rateBucket.get(k) || 0) + 1;
    rateBucket.set(k, n);
    // 清理旧 key
    if (rateBucket.size > 5000) {
        for (const key of rateBucket.keys()) {
            const d = parseInt(key.split('|')[1], 10);
            if (d < today - 1) rateBucket.delete(key);
        }
    }
    return n <= RATE_LIMIT_PER_DAY;
}

function jsonResp(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
            ...extraHeaders,
        },
    });
}
function jsonErr(status, code, msg) {
    return jsonResp({ ok: false, error: code, message: msg }, status);
}

async function pgFetch(path) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Accept': 'application/json',
        },
    });
}

async function fetchTable(path, fallback = []) {
    try {
        const r = await pgFetch(path);
        if (!r.ok) return fallback;
        return await r.json();
    } catch (e) {
        return fallback;
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'content-type',
            },
        });
    }

    if (req.method !== 'GET') {
        return jsonErr(405, 'method_not_allowed', '只接受 GET');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonErr(503, 'not_configured', 'SUPABASE env 未设');
    }

    const url = new URL(req.url);
    const studentId = (url.searchParams.get('student_id') || '').trim().toLowerCase();
    const token = (url.searchParams.get('token') || '').trim().toUpperCase();

    // 参数校验
    if (!studentId || !token) {
        return jsonErr(400, 'missing_params', 'student_id + token 必填（token = 找回码 / 末 6 位大写）');
    }
    if (!UUID_RE.test(studentId)) {
        return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');
    }
    // 找回码 = student_id 末 6 位大写（与 welcome.html 一致）
    const expectedToken = studentId.slice(-6).toUpperCase();
    if (token !== expectedToken) {
        return jsonErr(401, 'unauthorized', '找回码不匹配');
    }

    // 限流
    if (!checkRateLimit(studentId)) {
        return jsonErr(429, 'rate_limited', `每个学生每 24 小时最多导出 ${RATE_LIMIT_PER_DAY} 次`);
    }

    // 校验学生存在
    const profileRows = await fetchTable(`/students?id=eq.${studentId}&select=*`);
    if (!profileRows || profileRows.length === 0) {
        return jsonErr(404, 'student_not_found', '该 student_id 不存在或已删除');
    }
    const profile = profileRows[0];

    // 并行拉所有相关表
    const [
        dialogues,
        attempts,
        escalations,
        states,
        parentPushes,
        moderationFlagged,
    ] = await Promise.all([
        // dialogues 不导 embedding 字段（向量数据无意义且大）
        fetchTable(`/dialogues?student_id=eq.${studentId}&select=id,role,content,topic_code,session_id,created_at,client_hour&order=created_at.asc&limit=2000`),
        fetchTable(`/attempts?student_id=eq.${studentId}&select=*&order=created_at.asc&limit=2000`),
        fetchTable(`/escalations?student_id=eq.${studentId}&select=id,kind,status,priority,student_message,topic_code,ai_summary,created_at,claimed_at,resolved_at,resolution_kind,resolution_minutes&order=created_at.asc&limit=500`),
        fetchTable(`/student_states?student_id=eq.${studentId}&select=knowledge_point_id,mastery_score,model_name,updated_at&limit=500`),
        fetchTable(`/parent_pushes?student_id=eq.${studentId}&select=*&order=created_at.asc&limit=200`),
        // moderation 仅导出非 clean 的（clean 是日常普通对话，导出无意义）
        fetchTable(`/moderation_logs?student_id=eq.${studentId}&verdict=neq.clean&select=role,content_excerpt,verdict,flags,actions_taken,created_at&order=created_at.asc&limit=200`),
    ]);

    // 拼装导出包
    const exportPackage = {
        ok: true,
        export_meta: {
            student_id: studentId,
            exported_at: new Date().toISOString(),
            exporter_version: 'v1.0',
            legal_basis: 'PIPL 第 45 条（查阅、复制权）',
            data_categories: [
                'profile', 'dialogues', 'attempts', 'escalations',
                'student_states', 'parent_pushes', 'moderation_flagged',
            ],
            note: '本导出包包含您学习账户的全部业务数据。如需删除账户，请联系 dpo@yuandian.local 或在站内提交删除请求。',
            sensitive_field_note: '为保护信息安全，对话向量 embedding、内部 audit metadata 不在导出范围内。',
            retention_policy: '完整保留期限请见隐私政策。基本信息 3 年，对话 12 个月。',
        },
        profile: {
            id: profile.id,
            name: profile.name,
            grade: profile.grade,
            stage: profile.stage,
            subjects: profile.subjects,
            goals: profile.goals,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
            // auth_user_id / deleted_at 不导（后端字段）
        },
        dialogues: {
            count: dialogues.length,
            items: dialogues,
        },
        attempts: {
            count: attempts.length,
            items: attempts,
        },
        escalations: {
            count: escalations.length,
            items: escalations,
        },
        student_states: {
            count: states.length,
            items: states,
        },
        parent_pushes: {
            count: parentPushes.length,
            items: parentPushes,
        },
        moderation_flagged: {
            count: moderationFlagged.length,
            items: moderationFlagged,
            note: '仅包含被标记为 flag/escalate 的内容审核日志（clean 状态的常规对话不展示）',
        },
    };

    // 文件下载 header（用户保存到本地）
    const filename = `yuandian-export-${studentId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    return jsonResp(exportPackage, 200, {
        'Content-Disposition': `attachment; filename="${filename}"`,
    });
}
