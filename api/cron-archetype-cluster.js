// 原点智学 · 学生 archetype 聚类 cron 端点
//
// 触发：GitHub Actions 每天凌晨 2:30 UTC（北京 10:30）自动调用
// 也可手动 POST 触发：curl -X POST https://yuandianzhixue.com/api/cron-archetype-cluster -H "X-Admin-Token: $TOKEN"
//
// 逻辑：与 scripts/cluster-student-archetypes.py 完全一致（rule-based 5 类）
// 数据源：dialogues.meta.signals 6 字段 → student-level 9 维向量 → archetype
// 写回：students.goals.archetype + students.goals.archetype_meta
//
// 设计原因：Python 脚本只能本地手跑没人愿意，端点 + cron 才能真上线。
// archetype 落库后 v3 prompt 自动按 archetype_meta.hint 调风格。

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'nodejs' };  // 用 nodejs 而非 edge，因为可能批量上千 student

const ENGINE_VERSION = 'archetype-rule-v1.1-js';

const ARCHETYPES = {
  visual_slow_warm: '视觉慢热型',
  anxious_grinder:  '焦虑刷题型',
  concept_jumper:   '概念跳跃型',
  engaged_explorer: '主动探索型',
  steady_learner:   '稳健渐进型',
};

const ARCHETYPE_HINTS = {
  visual_slow_warm:  '多用图示/示意图，节奏放慢，每步都让学生确认才往下推',
  anxious_grinder:   '先共情情绪，再用类比降低认知负担，避免连续追问',
  concept_jumper:    'follow 学生跳跃但不断回扣根概念，警惕「会跳不会落地」',
  engaged_explorer:  '鼓励学生主导推理，tutor 退后做反问/苏格拉底式追问',
  steady_learner:    '保持当前节奏，定期复盘，每 5 题做一次小总结',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 必填');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchAllDialoguesWithSignals(supabase) {
  const all = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('dialogues')
      .select('student_id, role, content, meta')
      .not('meta->>signals_extracted_at', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + page - 1);
    if (error) throw new Error(`fetch dialogues: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
    offset += page;
  }
  return all;
}

async function fetchAllStudents(supabase) {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, goals')
    .is('deleted_at', null)
    .limit(10000);
  if (error) throw new Error(`fetch students: ${error.message}`);
  return data || [];
}

function aggregateStudentVectors(dialogues) {
  const byStudent = new Map();
  function blank() {
    return {
      n: 0, n_student_msgs: 0,
      visual: 0, verbal: 0, kinesthetic: 0, abstract: 0,
      anxiety: 0, engagement: 0, stuck: 0,
      analogy_true: 0, analogy_false: 0,
      char_total: 0,
    };
  }

  for (const d of dialogues) {
    const sid = d.student_id;
    if (!sid) continue;
    const signals = (d.meta && d.meta.signals) || null;
    if (!signals || typeof signals !== 'object') continue;

    if (!byStudent.has(sid)) byStudent.set(sid, blank());
    const s = byStudent.get(sid);
    s.n += 1;

    if (d.role === 'student') {
      s.n_student_msgs += 1;
      s.char_total += (d.content || '').length;
    }

    const cs = signals.cognitive_style;
    if (cs === 'visual')      s.visual += 1;
    else if (cs === 'verbal') s.verbal += 1;
    else if (cs === 'kinesthetic') s.kinesthetic += 1;
    else if (cs === 'abstract')    s.abstract += 1;

    const em = signals.emotion_state;
    if (em === '焦虑' || em === '沮丧') s.anxiety += 1;
    else if (em === '投入' || em === '自信') s.engagement += 1;

    if (signals.stuck_point) s.stuck += 1;

    const ae = signals.analogy_effective;
    if (ae === true) s.analogy_true += 1;
    else if (ae === false) s.analogy_false += 1;
  }

  const vectors = {};
  for (const [sid, s] of byStudent.entries()) {
    const n = Math.max(1, s.n);
    const nMsgs = Math.max(1, s.n_student_msgs);
    const analogyTotal = s.analogy_true + s.analogy_false;
    vectors[sid] = {
      n_dialogues: s.n,
      n_student_msgs: s.n_student_msgs,
      visual_ratio:      s.visual / n,
      verbal_ratio:      s.verbal / n,
      kinesthetic_ratio: s.kinesthetic / n,
      abstract_ratio:    s.abstract / n,
      anxiety_ratio:     s.anxiety / n,
      engagement_ratio:  s.engagement / n,
      stuck_density:     s.stuck / n,
      analogy_response:  analogyTotal > 0 ? s.analogy_true / analogyTotal : null,
      type_velocity_avg: s.n_student_msgs > 0 ? s.char_total / nMsgs : 0,
    };
  }
  return vectors;
}

function classifyArchetype(v) {
  if (v.n_dialogues < 5) return [null, '样本不足（<5 dialogue）'];

  const visual = v.visual_ratio;
  const verbal = v.verbal_ratio;
  const abstract = v.abstract_ratio;
  const anxiety = v.anxiety_ratio;
  const engagement = v.engagement_ratio;
  const stuck = v.stuck_density;
  const analogy = v.analogy_response || 0;

  if (visual >= 0.4 && stuck >= 0.3)
    return ['visual_slow_warm', `visual=${visual.toFixed(2)} stuck=${stuck.toFixed(2)}`];
  if (anxiety >= 0.4 && analogy >= 0.5)
    return ['anxious_grinder', `anxiety=${anxiety.toFixed(2)} analogy=${analogy.toFixed(2)}`];
  if (abstract >= 0.3 && stuck >= 0.4)
    return ['concept_jumper', `abstract=${abstract.toFixed(2)} stuck=${stuck.toFixed(2)}`];
  if (engagement >= 0.5 && verbal >= 0.3)
    return ['engaged_explorer', `engagement=${engagement.toFixed(2)} verbal=${verbal.toFixed(2)}`];
  return ['steady_learner', '默认兜底（无极端特征）'];
}

async function updateStudentArchetype(supabase, student, archetypeKey, reason, vector, dryRun) {
  const goals = (student.goals && typeof student.goals === 'object') ? { ...student.goals } : {};
  const meta = {
    key: archetypeKey,
    label_zh: archetypeKey ? ARCHETYPES[archetypeKey] : null,
    hint: archetypeKey ? ARCHETYPE_HINTS[archetypeKey] : null,
    reason,
    engine_version: ENGINE_VERSION,
    computed_at: new Date().toISOString(),
    vector_snapshot: {
      n_dialogues: vector.n_dialogues,
      visual_ratio: Math.round(vector.visual_ratio * 1000) / 1000,
      verbal_ratio: Math.round(vector.verbal_ratio * 1000) / 1000,
      abstract_ratio: Math.round(vector.abstract_ratio * 1000) / 1000,
      anxiety_ratio: Math.round(vector.anxiety_ratio * 1000) / 1000,
      engagement_ratio: Math.round(vector.engagement_ratio * 1000) / 1000,
      stuck_density: Math.round(vector.stuck_density * 1000) / 1000,
    },
  };
  goals.archetype = archetypeKey;
  goals.archetype_meta = meta;

  if (dryRun) return true;

  const { error } = await supabase
    .from('students')
    .update({ goals })
    .eq('id', student.id);
  if (error) {
    console.error(`update ${student.id}: ${error.message}`);
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  // POST + admin token 鉴权（与 cron-parent-push-scan 对齐）
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  const headerToken = req.headers['x-admin-token'] || req.headers['X-Admin-Token'] || '';
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return res.status(500).json({ ok: false, error: 'admin_token_not_configured' });
  if (headerToken !== adminToken) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const dryRun = req.query?.dry_run === '1' || req.query?.dry_run === 'true';
  const startedAt = Date.now();

  try {
    const supabase = getSupabase();

    const dialogues = await fetchAllDialoguesWithSignals(supabase);
    const vectors = aggregateStudentVectors(dialogues);
    const students = await fetchAllStudents(supabase);

    const dist = {
      visual_slow_warm: 0, anxious_grinder: 0, concept_jumper: 0,
      engaged_explorer: 0, steady_learner: 0,
      insufficient_samples: 0, no_data: 0,
    };
    let updated = 0, skipped = 0;

    for (const stu of students) {
      const v = vectors[stu.id];
      if (!v) { dist.no_data += 1; skipped += 1; continue; }

      const [archetypeKey, reason] = classifyArchetype(v);
      dist[archetypeKey || 'insufficient_samples'] += 1;
      if (!archetypeKey) { skipped += 1; continue; }

      const ok = await updateStudentArchetype(supabase, stu, archetypeKey, reason, v, dryRun);
      if (ok) updated += 1;
    }

    return res.status(200).json({
      ok: true,
      engine_version: ENGINE_VERSION,
      dry_run: dryRun,
      stats: {
        dialogues_scanned: dialogues.length,
        students_total: students.length,
        students_with_data: Object.keys(vectors).length,
        updated,
        skipped,
        distribution: dist,
      },
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error('archetype-cluster failed:', e);
    return res.status(500).json({
      ok: false,
      error: e.message || String(e),
      duration_ms: Date.now() - startedAt,
    });
  }
}
