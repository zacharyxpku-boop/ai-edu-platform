"""
build-question-bank-from-gaokao.py
====================================
从 OpenLMLab/GAOKAO-Bench 抽 2010-2022 高考真题，按知识点关键词归类。
输出 src/curriculum/questions-from-gaokao.json，对应 cn-k12-knowledge-ontology 高中部分。

GAOKAO-Bench 协议：Apache 2.0，可商用，标 attribution。
源：https://github.com/OpenLMLab/GAOKAO-Bench
论文：Zhang et al., Evaluating the Performance of Large Language Models on GAOKAO Benchmark, 2023

数据结构：
  Data/Objective_Questions/2010-2022_Math_I_MCQs.json
    { "keywords": [...], "example": [{ "year", "category", "question", "answer", "analysis", "score" }] }
  Data/Subjective_Questions/2010-2022_Math_I.json
    主观题 / 解答题，含步骤

用法：
  python scripts/build-question-bank-from-gaokao.py
"""
import csv
import glob
import json
import os
import sys
from datetime import date

GAOKAO_BASE = r"C:/Users/86136/Desktop/ai-coach-data/GAOKAO-Bench/Data"
OUT_PATH = r"C:/Users/86136/Desktop/claude/ai-edu-platform/src/curriculum/questions-from-gaokao.json"
STATS_PATH = r"C:/Users/86136/Desktop/claude/ai-edu-platform/src/curriculum/questions-from-gaokao-stats.json"

# ========== 高中数学 topic 关键词映射（kp_id 沿用 cn-k12-knowledge-ontology 风格，但高中部分待本体补全） ==========
HIGH_MATH_RULES = {
    "math.h.set_logic": {
        "name": "集合与常用逻辑用语",
        "keywords": ["集合", "并集", "交集", "补集", "充分条件", "必要条件", "全称", "存在量词"]
    },
    "math.h.func_concept": {
        "name": "函数·概念与性质",
        "keywords": [
            "f(x)", "f (x)", "y=f", "f(", "函数 f",
            "定义域", "值域", "单调", "奇偶", "周期", "对称",
            "复合函数", "反函数", "分段函数",
        ]
    },
    "math.h.func_basic": {
        "name": "基本初等函数",
        "keywords": [
            "指数函数", "对数函数", "幂函数", "幂", "指数", "对数",
            "ln", "lg", "log", "e^x", "2^x", "a^x",
        ]
    },
    "math.h.trig": {
        "name": "三角函数",
        "keywords": [
            "正弦", "余弦", "正切", "三角", "周期函数",
            "sin", "cos", "tan", "弧度", "三角恒等",
            "诱导公式", "和差化积", "积化和差",
            "α", "β", "γ", "θ",   # 三角题常见角符号
        ]
    },
    "math.h.vector": {
        "name": "平面向量",
        "keywords": ["向量", "点乘", "叉乘", "数量积", "向量垂直", "向量平行"]
    },
    "math.h.complex": {
        "name": "复数",
        "keywords": ["复数", "虚部", "实部", "共轭", "模长"]
    },
    "math.h.solid_geom": {
        "name": "立体几何",
        "keywords": ["三棱锥", "四面体", "圆锥", "圆柱", "球", "二面角", "异面直线", "线面角"]
    },
    "math.h.line_circle": {
        "name": "直线与圆",
        "keywords": ["直线方程", "斜率", "倾斜角", "圆方程", "圆心"]
    },
    "math.h.conic": {
        "name": "圆锥曲线",
        "keywords": ["椭圆", "双曲线", "抛物线", "焦点", "准线", "离心率"]
    },
    "math.h.algorithm_seq": {
        "name": "数列",
        "keywords": ["数列", "等差", "等比", "通项", "求和", "递推"]
    },
    "math.h.ineq": {
        "name": "不等式",
        "keywords": ["不等式", "线性规划", "基本不等式", "均值不等式"]
    },
    "math.h.deriv": {
        "name": "导数",
        "keywords": [
            "导数", "导函数", "f'(x)", "f '(x)", "y'",
            "切线", "极值", "极大值", "极小值",
            "凹凸", "拐点",
            "单调递增", "单调递减",
            "在(0", "求导",
        ]
    },
    "math.h.prob_stat": {
        "name": "概率与统计",
        "keywords": ["概率", "分布", "期望", "方差", "正态", "二项分布", "排列", "组合", "回归", "独立性检验"]
    },
}


def estimate_difficulty(question, analysis, year):
    """高考题基础难度 0.65，根据题长 / 分值粗调"""
    base = 0.65
    q = question or ""
    a = analysis or ""
    bonus = 0.0
    if len(q) > 250: bonus += 0.1
    if len(a) > 500: bonus += 0.1
    if "证明" in q or "讨论" in q: bonus += 0.1
    if "(本题满分 12 分)" in q or "12 分" in q: bonus += 0.05
    return round(min(0.95, max(0.4, base + bonus)), 2)


def classify_high_math(text):
    hits = []
    for tid, rule in HIGH_MATH_RULES.items():
        for kw in rule["keywords"]:
            if kw in text:
                hits.append(tid)
                break
    return hits


def parse_obj_question(row, source_file, idx):
    """objective questions schema: { year, category, question, answer:[], analysis, index, score }"""
    qtext = (row.get("question") or "").strip()
    ans = row.get("answer")
    if isinstance(ans, list): ans = ",".join(map(str, ans))
    analysis = row.get("analysis", "")
    blob = qtext + " " + analysis
    topic_ids = classify_high_math(blob)
    if not topic_ids: return None
    return {
        "id": f"gaokao-obj-{os.path.basename(source_file).replace('.json', '')}-{row.get('index', idx)}",
        "type": "mcq",
        "stem": qtext,
        "answer": str(ans).strip(),
        "explanation": analysis,
        "topic_ids": topic_ids,
        "primary_topic": topic_ids[0],
        "subject": "math",
        "stage": "high",
        "grade": 12,
        "year": row.get("year"),
        "category": row.get("category"),
        "score": row.get("score"),
        "difficulty": estimate_difficulty(qtext, analysis, row.get("year")),
        "source": {
            "dataset": "GAOKAO-Bench",
            "file": os.path.basename(source_file),
            "index": row.get("index", idx),
        },
    }


def parse_sub_question(row, source_file, idx):
    """subjective questions: 解答题，含步骤"""
    qtext = (row.get("question") or "").strip()
    ans = row.get("answer", "")
    analysis = row.get("analysis", "")
    blob = qtext + " " + analysis
    topic_ids = classify_high_math(blob)
    if not topic_ids: return None
    return {
        "id": f"gaokao-sub-{os.path.basename(source_file).replace('.json', '')}-{idx}",
        "type": "subjective",
        "stem": qtext,
        "answer": str(ans).strip() if not isinstance(ans, list) else "\n".join(map(str, ans)),
        "explanation": analysis,
        "topic_ids": topic_ids,
        "primary_topic": topic_ids[0],
        "subject": "math",
        "stage": "high",
        "grade": 12,
        "year": row.get("year"),
        "category": row.get("category"),
        "score": row.get("score"),
        "has_steps": True,
        "difficulty": estimate_difficulty(qtext, analysis, row.get("year")),
        "source": {
            "dataset": "GAOKAO-Bench",
            "file": os.path.basename(source_file),
            "index": idx,
        },
    }


def main():
    if not os.path.exists(GAOKAO_BASE):
        print(f"[ERROR] GAOKAO_BASE not found: {GAOKAO_BASE}", file=sys.stderr)
        sys.exit(1)

    obj_files = glob.glob(os.path.join(GAOKAO_BASE, "Objective_Questions", "*Math*.json"))
    sub_files = glob.glob(os.path.join(GAOKAO_BASE, "Subjective_Questions", "*Math*.json"))

    all_q = []
    seen_stems = set()

    print(f"[info] 扫描 {len(obj_files)} 客观题文件 + {len(sub_files)} 主观题文件")

    for fn in obj_files:
        with open(fn, encoding="utf-8") as f:
            d = json.load(f)
        examples = d.get("example") if isinstance(d, dict) else d
        if not isinstance(examples, list): continue
        for i, row in enumerate(examples):
            q = parse_obj_question(row, fn, i)
            if not q: continue
            key = q["stem"][:80]
            if key in seen_stems: continue
            seen_stems.add(key)
            all_q.append(q)

    for fn in sub_files:
        with open(fn, encoding="utf-8") as f:
            d = json.load(f)
        examples = d.get("example") if isinstance(d, dict) else d
        if not isinstance(examples, list): continue
        for i, row in enumerate(examples):
            q = parse_sub_question(row, fn, i)
            if not q: continue
            key = q["stem"][:80]
            if key in seen_stems: continue
            seen_stems.add(key)
            all_q.append(q)

    # 按 topic 分组统计
    by_topic = {}
    by_year = {}
    by_type = {"mcq": 0, "subjective": 0}
    for q in all_q:
        for tid in q["topic_ids"]:
            by_topic.setdefault(tid, 0)
            by_topic[tid] += 1
        by_year.setdefault(q.get("year"), 0)
        by_year[q.get("year")] += 1
        by_type[q["type"]] += 1

    stats = {
        "version": "1.0",
        "generated": str(date.today()),
        "source": "OpenLMLab/GAOKAO-Bench",
        "license": "Apache 2.0",
        "attribution": "Zhang et al., Evaluating the Performance of Large Language Models on GAOKAO Benchmark, 2023",
        "url": "https://github.com/OpenLMLab/GAOKAO-Bench",
        "totals": {
            "questions": len(all_q),
            "mcq": by_type["mcq"],
            "subjective": by_type["subjective"],
            "topics_with_questions": len([t for t, c in by_topic.items() if c > 0]),
            "topics_empty": len([t for t in HIGH_MATH_RULES if t not in by_topic]),
        },
        "per_topic": {tid: {
            "name": HIGH_MATH_RULES[tid]["name"],
            "count": cnt,
        } for tid, cnt in by_topic.items()},
        "per_year": dict(sorted(by_year.items())),
        "empty_topics": sorted([t for t in HIGH_MATH_RULES if t not in by_topic]),
    }

    out = {
        "version": "1.0",
        "generated": str(date.today()),
        "source": "GAOKAO-Bench",
        "license": "Apache 2.0",
        "stage": "high",
        "subject": "math",
        "questions": all_q,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    with open(STATS_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"\n=== 输出 ===")
    print(f"题库 → {OUT_PATH}  ({len(all_q)} 题, MCQ {by_type['mcq']}, 解答 {by_type['subjective']})")
    print(f"统计 → {STATS_PATH}")
    print(f"\n=== 各 topic 题量 ===")
    for tid, info in sorted(stats["per_topic"].items(), key=lambda x: -x[1]["count"]):
        print(f"  {tid:<28} {info['name']:<18} {info['count']:>4} 题")
    if stats["empty_topics"]:
        print(f"\n=== 空 topic（关键词没命中）===")
        for t in stats["empty_topics"]:
            print(f"  {t} ({HIGH_MATH_RULES[t]['name']})")
    print(f"\n=== 按年份 ===")
    for y, c in sorted(stats["per_year"].items()):
        print(f"  {y}: {c}")


if __name__ == "__main__":
    main()
