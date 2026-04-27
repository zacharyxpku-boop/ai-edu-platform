"""
build-question-bank-from-eeval.py
==================================
从 E-EVAL（小初高三档评测集）抽中文 K12 真题，按关键词归类挂到 math.json 的 topic 上。
输出 src/curriculum/questions-from-eeval.json（前端 mastery-loop / 题库展示页可用）。

E-EVAL 协议：MIT，可商用，标 attribution。
源：https://github.com/AI-EDU-LAB/E-EVAL
论文：ACL'24 Findings

用法：
    python scripts/build-question-bank-from-eeval.py
"""
import csv
import glob
import json
import os
import sys
from datetime import date

EEVAL_BASE = r"C:/Users/86136/Desktop/ai-coach-data/E-EVAL/data"
OUT_PATH = r"C:/Users/86136/Desktop/claude/ai-edu-platform/src/curriculum/questions-from-eeval.json"
STATS_PATH = r"C:/Users/86136/Desktop/claude/ai-edu-platform/src/curriculum/questions-from-eeval-stats.json"

# ========== topic 关键词映射表 ==========
# topic_id 沿用 math.json 的层级编码：subject.grade.chapter.topic
# 关键词命中即归类，可多类
TOPIC_RULES = {
    # === 初中数学 ===
    "math.7.expr.integer": {
        "name": "整式·定义与运算",
        "stage": "middle", "subject": "math", "grade": 7,
        "keywords": ["单项式", "多项式", "整式", "同类项", "合并同类项", "去括号"],
    },
    "math.7.eq.linear": {
        "name": "一元一次方程",
        "stage": "middle", "subject": "math", "grade": 7,
        "keywords": ["一元一次方程", "解方程", "移项", "去分母"],
    },
    "math.7.geom.basics": {
        "name": "几何图形·基础",
        "stage": "middle", "subject": "math", "grade": 7,
        "keywords": ["直线", "射线", "线段", "角", "平行", "相交"],
    },
    "math.7.frac.expr": {
        "name": "分式",
        "stage": "middle", "subject": "math", "grade": 7,
        "keywords": ["分式", "分式方程", "通分", "约分"],
    },
    "math.8.eq.system": {
        "name": "二元一次方程组",
        "stage": "middle", "subject": "math", "grade": 8,
        "keywords": ["二元一次方程组", "代入消元", "加减消元"],
    },
    "math.8.ineq": {
        "name": "一元一次不等式",
        "stage": "middle", "subject": "math", "grade": 8,
        "keywords": ["不等式", "不等式组", "解集"],
    },
    "math.8.func.linear": {
        "name": "一次函数",
        "stage": "middle", "subject": "math", "grade": 8,
        "keywords": ["一次函数", "正比例函数", "k值", "斜率"],
    },
    "math.8.geom.triangle": {
        "name": "三角形",
        "stage": "middle", "subject": "math", "grade": 8,
        "keywords": ["三角形", "全等", "相似", "勾股", "直角三角形"],
    },
    "math.9.eq.quadratic": {
        "name": "一元二次方程",
        "stage": "middle", "subject": "math", "grade": 9,
        "keywords": ["一元二次方程", "判别式", "根的公式", "因式分解法", "配方法"],
    },
    "math.9.func.quadratic": {
        "name": "二次函数",
        "stage": "middle", "subject": "math", "grade": 9,
        "keywords": ["二次函数", "抛物线", "顶点", "对称轴"],
    },
    "math.9.geom.circle": {
        "name": "圆",
        "stage": "middle", "subject": "math", "grade": 9,
        "keywords": ["圆", "圆心", "弧", "弦", "切线", "圆周角"],
    },
    "math.9.stat": {
        "name": "统计与概率",
        "stage": "middle", "subject": "math", "grade": 9,
        "keywords": ["平均数", "中位数", "众数", "方差", "概率", "频率"],
    },
    # === 高中数学（若想拓展用 High_School_Mathematics） ===
    "math.h.set": {
        "name": "集合与逻辑",
        "stage": "high", "subject": "math", "grade": 10,
        "keywords": ["集合", "并集", "交集", "补集", "充分", "必要"],
    },
    "math.h.func": {
        "name": "函数·概念与性质",
        "stage": "high", "subject": "math", "grade": 10,
        "keywords": ["函数", "定义域", "值域", "单调", "奇偶"],
    },
}

# 难度估算启发式
def estimate_difficulty(question, explanation, stage):
    base = {"primary": 0.3, "middle": 0.5, "high": 0.7}.get(stage, 0.5)
    q = question or ""
    e = explanation or ""
    bonus = 0.0
    if len(q) > 200: bonus += 0.1
    if len(e) > 300: bonus += 0.1
    if any(k in q for k in ["证明", "讨论", "综合"]): bonus += 0.15
    if "?" in q or "？" in q: bonus -= 0.05
    return round(min(0.95, max(0.15, base + bonus)), 2)


def classify(text):
    """返回命中的所有 topic_id 列表"""
    hits = []
    for tid, rule in TOPIC_RULES.items():
        for kw in rule["keywords"]:
            if kw in text:
                hits.append(tid)
                break
    return hits


def normalize_question(row, source_dataset, source_file, idx):
    qid = f"eeval-{os.path.basename(source_file).replace('.csv', '')}-{idx}"
    stem_raw = (row.get("question") or "").strip()
    options = {k: (row.get(k) or "").strip() for k in ("A", "B", "C", "D") if row.get(k)}
    blob = stem_raw + " " + (row.get("explanation") or "")
    topic_ids = classify(blob)
    if not topic_ids:
        return None
    primary = topic_ids[0]
    rule = TOPIC_RULES[primary]
    return {
        "id": qid,
        "type": "mcq",
        "stem": stem_raw,
        "options": options,
        "answer": (row.get("answer") or "").strip(),
        "explanation": (row.get("explanation") or "").strip(),
        "topic_ids": topic_ids,
        "primary_topic": primary,
        "subject": rule["subject"],
        "stage": rule["stage"],
        "grade": rule["grade"],
        "difficulty": estimate_difficulty(stem_raw, row.get("explanation"), rule["stage"]),
        "source": {
            "dataset": source_dataset,
            "file": os.path.basename(source_file),
            "row": int(row.get("id", idx)),
        },
    }


def main():
    if not os.path.exists(EEVAL_BASE):
        print(f"[ERROR] EEVAL_BASE not found: {EEVAL_BASE}", file=sys.stderr)
        sys.exit(1)

    # 扫所有 Middle/Primary/High Math + 也扫一些 Physics/Chemistry/Biology 备用（可注释）
    targets = [
        ("E-EVAL Middle School Math", "Middle_School_Mathematics_*.csv"),
        ("E-EVAL High School Math", "High_School_Mathematics_*.csv"),
        ("E-EVAL Primary School Math", "Primary_School_Mathematics_*.csv"),
    ]

    all_questions = []
    seen_stems = set()
    per_target = {}

    for dataset_name, pattern in targets:
        files = glob.glob(os.path.join(EEVAL_BASE, "*", pattern))
        target_count = 0
        for fn in files:
            with open(fn, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for i, row in enumerate(reader):
                    q = normalize_question(row, dataset_name, fn, i)
                    if not q:
                        continue
                    # 去重（题干前 60 字符）
                    key = q["stem"][:60]
                    if key in seen_stems:
                        continue
                    seen_stems.add(key)
                    all_questions.append(q)
                    target_count += 1
        per_target[dataset_name] = {"files": len(files), "questions_kept": target_count}
        print(f"[{dataset_name}] {target_count} 道题入库（扫 {len(files)} 文件）")

    # 按 topic 分组统计
    by_topic = {}
    for q in all_questions:
        for tid in q["topic_ids"]:
            by_topic.setdefault(tid, []).append(q["id"])

    stats = {
        "version": "1.0",
        "generated": str(date.today()),
        "source": "E-EVAL (AI-EDU-LAB)",
        "license": "MIT",
        "attribution": "Hou et al., E-EVAL: A Comprehensive Chinese K-12 Education Evaluation Benchmark, ACL 2024 Findings",
        "url": "https://github.com/AI-EDU-LAB/E-EVAL",
        "totals": {
            "questions": len(all_questions),
            "topics_with_questions": len([t for t, ids in by_topic.items() if ids]),
            "topics_empty": len([t for t in TOPIC_RULES if t not in by_topic]),
        },
        "per_target": per_target,
        "per_topic": {tid: {
            "name": TOPIC_RULES[tid]["name"],
            "stage": TOPIC_RULES[tid]["stage"],
            "grade": TOPIC_RULES[tid]["grade"],
            "count": len(ids),
        } for tid, ids in by_topic.items()},
        "empty_topics": sorted([t for t in TOPIC_RULES if t not in by_topic]),
    }

    out = {
        "version": "1.0",
        "generated": str(date.today()),
        "source": "E-EVAL",
        "license": "MIT",
        "topic_rules_count": len(TOPIC_RULES),
        "questions": all_questions,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    with open(STATS_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"\n=== 输出 ===")
    print(f"题库 → {OUT_PATH}  ({len(all_questions)} 题)")
    print(f"统计 → {STATS_PATH}")
    print(f"\n=== 各 topic 题量 ===")
    for tid, info in sorted(stats["per_topic"].items(), key=lambda x: -x[1]["count"]):
        print(f"  {tid:<25} {info['name']:<20} {info['count']:>4} 题")
    if stats["empty_topics"]:
        print(f"\n=== 空 topic（关键词没命中，需要补 keyword）===")
        for t in stats["empty_topics"]:
            print(f"  {t} ({TOPIC_RULES[t]['name']})")


if __name__ == "__main__":
    main()
