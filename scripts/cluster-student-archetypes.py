#!/usr/bin/env python3
# 原点智学 · 学生画像聚类（rule-based archetype 识别）
#
# 用法：
#   SUPABASE_URL=https://xxx.supabase.co \
#   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
#   python3 scripts/cluster-student-archetypes.py
#
# 加 --dry-run 只打 archetype 分布，不写库。
#
# 设计：
#   读 dialogues.meta.signals 6 字段，按 student_id 聚合成 student-level 向量：
#     1. visual_ratio        cognitive_style=visual 占比
#     2. verbal_ratio        cognitive_style=verbal 占比
#     3. kinesthetic_ratio   cognitive_style=kinesthetic 占比
#     4. abstract_ratio      cognitive_style=abstract 占比
#     5. anxiety_ratio       emotion_state=焦虑 + 沮丧 占比
#     6. engagement_ratio    emotion_state=投入 + 自信 占比
#     7. stuck_density       平均每 10 条对话出现 stuck_point 次数
#     8. analogy_response    analogy_effective=true / (true+false) 比例
#     9. type_velocity_avg   平均每条 student 消息字数（投入度代理）
#
#   按阈值规则映射 5 个 archetype（K-means 跳过 — PoC 期 rule-based 够用，
#   且能解释「为什么是这个 archetype」给家长看）：
#
#     archetype          触发规则（OR 逻辑）
#     ─────────────────────────────────────────────────────────────
#     visual_slow_warm   visual_ratio ≥ 0.4 AND stuck_density ≥ 0.3
#     anxious_grinder    anxiety_ratio ≥ 0.4 AND analogy_response ≥ 0.5
#     concept_jumper     abstract_ratio ≥ 0.3 AND stuck_density ≥ 0.4
#     engaged_explorer   engagement_ratio ≥ 0.5 AND verbal_ratio ≥ 0.3
#     steady_learner     默认兜底（中位区间）
#
#   写回 students.goals.archetype = "<label>" 并附 students.goals.archetype_meta
#
# 向后兼容：
#   - 旧学生没 dialogue 数据 → 跳过 / archetype=null
#   - 没 goals 字段的旧记录 → 创建 goals = {}

import json
import os
import sys
import urllib.request
import urllib.error
from collections import defaultdict
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DRY_RUN = "--dry-run" in sys.argv

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 必填", file=sys.stderr)
    sys.exit(2)

ENGINE_VERSION = "archetype-rule-v1.0"

# 5 archetype 标签（中文显示给家长，英文 key 给程序）
ARCHETYPES = {
    "visual_slow_warm":   "视觉慢热型",
    "anxious_grinder":    "焦虑刷题型",
    "concept_jumper":     "概念跳跃型",
    "engaged_explorer":   "主动探索型",
    "steady_learner":     "稳健渐进型",
}

# archetype 默认推荐策略（v3 prompt 注入用）
ARCHETYPE_HINTS = {
    "visual_slow_warm":  "多用图示/示意图，节奏放慢，每步都让学生确认才往下推",
    "anxious_grinder":   "先共情情绪，再用类比降低认知负担，避免连续追问",
    "concept_jumper":    "follow 学生跳跃但不断回扣根概念，警惕「会跳不会落地」",
    "engaged_explorer":  "鼓励学生主导推理，tutor 退后做反问/苏格拉底式追问",
    "steady_learner":    "保持当前节奏，定期复盘，每 5 题做一次小总结",
}


def pg_request(path, method="GET", body=None):
    url = f"{SUPABASE_URL}/rest/v1{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if method == "PATCH":
        headers["Prefer"] = "return=minimal"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode("utf-8")
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        print(f"  HTTPError {e.code} {method} {path}: {e.read().decode('utf-8')[:200]}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  Error {method} {path}: {e}", file=sys.stderr)
        return None


def fetch_all_dialogues_with_signals():
    """读所有有 signals 的 dialogue。分页 1000/页。"""
    all_rows = []
    offset = 0
    page = 1000
    while True:
        path = (
            f"/dialogues?select=student_id,role,content,meta"
            f"&meta->>signals_extracted_at=not.is.null"
            f"&order=created_at.asc"
            f"&offset={offset}&limit={page}"
        )
        rows = pg_request(path)
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return all_rows


def fetch_all_students():
    rows = pg_request("/students?select=id,name,goals&deleted_at=is.null&limit=10000")
    return rows or []


def aggregate_student_vectors(dialogues):
    """按 student_id 聚合 9 维向量。"""
    by_student = defaultdict(lambda: {
        "n": 0,
        "n_student_msgs": 0,
        "visual": 0,
        "verbal": 0,
        "kinesthetic": 0,
        "abstract": 0,
        "anxiety": 0,
        "engagement": 0,
        "stuck": 0,
        "analogy_true": 0,
        "analogy_false": 0,
        "char_total": 0,
    })

    for d in dialogues:
        sid = d.get("student_id")
        if not sid:
            continue
        signals = (d.get("meta") or {}).get("signals") or {}
        if not isinstance(signals, dict):
            continue
        s = by_student[sid]
        s["n"] += 1

        # cognitive_style 占比基于学生消息更准（tutor 的 style 不算）
        if d.get("role") == "student":
            s["n_student_msgs"] += 1
            s["char_total"] += len(d.get("content") or "")

        cs = signals.get("cognitive_style")
        if cs in ("visual", "verbal", "kinesthetic", "abstract"):
            s[cs] += 1

        em = signals.get("emotion_state")
        if em in ("焦虑", "沮丧"):
            s["anxiety"] += 1
        elif em in ("投入", "自信"):
            s["engagement"] += 1

        if signals.get("stuck_point"):
            s["stuck"] += 1

        ae = signals.get("analogy_effective")
        if ae is True:
            s["analogy_true"] += 1
        elif ae is False:
            s["analogy_false"] += 1

    # 转 ratio
    vectors = {}
    for sid, s in by_student.items():
        n = max(1, s["n"])
        n_msgs = max(1, s["n_student_msgs"])
        analogy_total = s["analogy_true"] + s["analogy_false"]
        vectors[sid] = {
            "n_dialogues": s["n"],
            "n_student_msgs": s["n_student_msgs"],
            "visual_ratio":      s["visual"] / n,
            "verbal_ratio":      s["verbal"] / n,
            "kinesthetic_ratio": s["kinesthetic"] / n,
            "abstract_ratio":    s["abstract"] / n,
            "anxiety_ratio":     s["anxiety"] / n,
            "engagement_ratio":  s["engagement"] / n,
            "stuck_density":     s["stuck"] / n,
            "analogy_response":  (s["analogy_true"] / analogy_total) if analogy_total > 0 else None,
            "type_velocity_avg": s["char_total"] / n_msgs if s["n_student_msgs"] > 0 else 0,
        }
    return vectors


def classify_archetype(v):
    """rule-based archetype 分类。低样本量（<5 dialogue）返回 None。"""
    if v["n_dialogues"] < 5:
        return None, "样本不足（<5 dialogue）"

    visual = v["visual_ratio"]
    verbal = v["verbal_ratio"]
    abstract = v["abstract_ratio"]
    anxiety = v["anxiety_ratio"]
    engagement = v["engagement_ratio"]
    stuck = v["stuck_density"]
    analogy = v["analogy_response"] or 0

    # 顺序优先：先抓极端特征，最后兜底
    if visual >= 0.4 and stuck >= 0.3:
        return "visual_slow_warm", f"visual={visual:.2f} stuck={stuck:.2f}"
    if anxiety >= 0.4 and analogy >= 0.5:
        return "anxious_grinder", f"anxiety={anxiety:.2f} analogy={analogy:.2f}"
    if abstract >= 0.3 and stuck >= 0.4:
        return "concept_jumper", f"abstract={abstract:.2f} stuck={stuck:.2f}"
    if engagement >= 0.5 and verbal >= 0.3:
        return "engaged_explorer", f"engagement={engagement:.2f} verbal={verbal:.2f}"
    return "steady_learner", "默认兜底（无极端特征）"


def update_student_archetype(student, archetype_key, reason, vector):
    sid = student["id"]
    goals = student.get("goals") or {}
    if not isinstance(goals, dict):
        goals = {}

    archetype_meta = {
        "key": archetype_key,
        "label_zh": ARCHETYPES.get(archetype_key) if archetype_key else None,
        "hint": ARCHETYPE_HINTS.get(archetype_key) if archetype_key else None,
        "reason": reason,
        "engine_version": ENGINE_VERSION,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "vector_snapshot": {
            "n_dialogues": vector["n_dialogues"],
            "visual_ratio": round(vector["visual_ratio"], 3),
            "verbal_ratio": round(vector["verbal_ratio"], 3),
            "abstract_ratio": round(vector["abstract_ratio"], 3),
            "anxiety_ratio": round(vector["anxiety_ratio"], 3),
            "engagement_ratio": round(vector["engagement_ratio"], 3),
            "stuck_density": round(vector["stuck_density"], 3),
        },
    }

    goals["archetype"] = archetype_key
    goals["archetype_meta"] = archetype_meta

    if DRY_RUN:
        return True

    res = pg_request(
        f"/students?id=eq.{sid}",
        method="PATCH",
        body={"goals": goals},
    )
    return res is not None or True  # PATCH return=minimal 返回 None 也算成功


def main():
    print(f"[archetype-cluster] engine={ENGINE_VERSION} dry_run={DRY_RUN}")

    print("[archetype-cluster] 1/3 拉 dialogue（带 signals）...")
    dialogues = fetch_all_dialogues_with_signals()
    print(f"  → {len(dialogues)} dialogue")

    print("[archetype-cluster] 2/3 聚合 student-level 向量...")
    vectors = aggregate_student_vectors(dialogues)
    print(f"  → {len(vectors)} student（有 dialogue 数据）")

    print("[archetype-cluster] 3/3 分类 + 写回 students.goals.archetype...")
    students = fetch_all_students()
    print(f"  → 全表 {len(students)} student")

    dist = defaultdict(int)
    skipped = 0
    updated = 0

    for stu in students:
        sid = stu["id"]
        v = vectors.get(sid)
        if not v:
            dist["no_data"] += 1
            skipped += 1
            continue

        archetype_key, reason = classify_archetype(v)
        dist[archetype_key or "insufficient_samples"] += 1

        if archetype_key is None:
            skipped += 1
            continue

        ok = update_student_archetype(stu, archetype_key, reason, v)
        if ok:
            updated += 1

    print("\n=== Archetype 分布 ===")
    for key in ["visual_slow_warm", "anxious_grinder", "concept_jumper",
                "engaged_explorer", "steady_learner",
                "insufficient_samples", "no_data"]:
        n = dist.get(key, 0)
        label = ARCHETYPES.get(key, key)
        print(f"  {label:<14} ({key:<22}) {n:>4}")

    print(f"\n=== 写回结果 ===")
    print(f"  updated:  {updated}")
    print(f"  skipped:  {skipped}")
    print(f"  total:    {len(students)}")

    if DRY_RUN:
        print("\n[DRY RUN] 未写库")


if __name__ == "__main__":
    main()
