# -*- coding: utf-8 -*-
"""
eval-reverse-link.py
跑一遍 seed-questions.json + seed-questions-generated.json 进章节匹配引擎
算反链命中率：有多少题能落到某一章并得分 ≥6。
输出 src/curriculum/reverse-link-report.json，platform.html 会拉这份报告当成绩单贴出来。

规则必须与 api/chapter-match.js 和 tools/knowledge-arcade.html 里的打分一致，不然报告就说谎。
这里把两边的 alias 表硬拷一份进来，保证单机可跑不依赖 Vercel edge runtime。
"""
import io
import json
import sys
import time
from pathlib import Path
from collections import Counter, defaultdict

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "extracted" / "manifest.json"
SEED = ROOT / "src" / "curriculum" / "seed-questions.json"
GEN = ROOT / "src" / "curriculum" / "seed-questions-generated.json"
OUT = ROOT / "src" / "curriculum" / "reverse-link-report.json"

SUBJ_MAP = {
    "math": "数学", "physics": "物理", "chemistry": "化学", "biology": "生物学",
    "chinese": "语文", "english": "英语", "history": "历史", "geography": "地理",
    "politics": "思想政治", "moral": "道德与法治",
}

ALIASES = {
    "physics": {
        "力学基础": ["力", "运动", "机械"], "力学": ["力", "运动", "机械"], "力学综合": ["机械", "功", "简单机械"],
        "声学": ["声"], "光学": ["光", "透镜"],
        "电学": ["电", "欧姆", "电路", "电压", "电流", "电功率", "信息"],
        "磁学": ["磁", "电与磁"], "磁场与电流": ["磁", "电与磁"],
        "运动学": ["运动"], "功与能": ["功", "机械能"],
        "内能与热量": ["内能", "热"], "惯性": ["运动", "力"], "力与运动": ["运动和力", "力"],
    },
    "chemistry": {
        "物质的组成": ["物质构成", "奥秘", "元素"], "元素周期表": ["物质构成", "元素"], "原子结构": ["物质构成", "奥秘"],
        "化学反应计算": ["化学方程式"], "化学综合": ["化学方程式", "化学反应"], "化学反应类型": ["化学方程式"],
        "酸碱中和": ["酸和碱"], "质量守恒": ["化学方程式"],
        "常见物质": ["碳", "空气", "水"], "氧化还原": ["碳的氧化物", "燃料"], "氧气的制备": ["空气", "周围的空气"],
        "金属活动性": ["金属"], "溶液计算": ["溶液"],
        "碳酸钠与碳酸氢钠": ["盐", "化肥"],
    },
    "math": {
        "数据的描述": ["统计", "概率"], "数据分析": ["统计", "概率"],
        "比和比例": ["比例", "分式"], "相似三角形": ["相似", "图形"],
        "面积与体积": ["立体几何", "几何"], "整式的乘除": ["整式", "代数"],
        "综合应用": ["方程", "应用"], "综合": ["综合"],
    },
    "biology": {
        "细胞": ["细胞", "分子"], "遗传": ["遗传", "进化", "基因"], "生态": ["生物与环境", "生态", "稳态"],
        "植物": ["植物", "生物圈", "绿色"], "动物": ["动物", "人体"], "人体": ["人体", "健康"],
    },
    "chinese": {
        "古诗词": ["诗", "词", "古"], "文言文": ["文言", "古文"], "记叙文": ["记叙", "散文"],
        "现代文": ["现代文", "阅读"], "写作": ["作文", "写作"], "综合性学习": ["综合"],
    },
    "history": {
        "古代史": ["先秦", "秦汉", "隋唐", "宋元", "明清", "中国古代"], "近代史": ["近代", "鸦片", "辛亥", "抗日", "解放"],
        "现代史": ["新中国", "改革开放", "现代化"], "世界古代": ["古希腊", "古罗马", "中世纪"],
        "世界近代": ["资本主义", "工业革命", "近代"], "世界现代": ["两次世界大战", "冷战", "全球化"],
    },
    "geography": {
        "地形": ["地形", "地势", "山河"], "气候": ["气候", "天气"], "人口": ["人口", "聚落"],
        "工业": ["工业", "经济"], "农业": ["农业", "土地"], "区域": ["区域", "省", "亚洲", "欧洲", "非洲"],
        "自然地理": ["自然地理", "地壳", "地球"], "人文地理": ["人文", "文化", "聚落"],
    },
    "politics": {
        "法律": ["法律", "权利", "宪法"], "经济": ["经济", "市场", "消费"], "政治制度": ["政治", "制度", "民主"],
        "哲学": ["哲学", "辩证", "唯物"], "文化": ["文化", "精神文明"], "国际": ["国际", "世界"],
    },
    "moral": {
        "成长": ["成长", "自我", "青春"], "家庭": ["家", "父母", "亲情"], "学校": ["学校", "师生", "同学"],
        "社会": ["社会", "公民", "责任"], "国家": ["国家", "祖国", "民族"], "法律": ["法律", "宪法", "权利"],
    },
}


def ngrams(s, n):
    s = (s or "").strip()
    if len(s) < n:
        return []
    return [s[i:i + n] for i in range(len(s) - n + 1)]


def score_chapter(title, subject, hint, kps):
    title = title or ""
    score = 0
    hits = []
    hint = (hint or "").strip()
    if hint:
        if hint in title:
            score += 12; hits.append("hint_substr")
        else:
            grums = sum(1 for g in ngrams(hint, 3) if g in title)
            if grums > 0:
                score += min(grums, 3) * 4; hits.append(f"hint_3gram:{grums}")
        for alias in (ALIASES.get(subject) or {}).get(hint, []):
            if alias and alias in title:
                score += 8; hits.append(f"alias:{alias}")
    for kp in kps or []:
        k = (kp or "").strip()
        if not k:
            continue
        if k in title:
            score += 6; hits.append(f"kp:{k}")
        elif len(k) >= 3 and k[:3] in title:
            score += 2; hits.append(f"kp_prefix:{k}")
    return score, hits


def match_question(q, manifest_books):
    subj = q.get("subject")
    zh = SUBJ_MAP.get(subj)
    if not zh:
        return None
    hint = q.get("chapter") or ""
    kps = q.get("knowledge_points") or []
    best = None
    for b in manifest_books:
        if b.get("subject") != zh:
            continue
        for c in b.get("chapters", []):
            s, hits = score_chapter(c.get("title", ""), subj, hint, kps)
            if s <= 0:
                continue
            cand = {"score": s, "path": b.get("path"), "ch": c.get("ch"), "title": c.get("title"), "hits": hits}
            if not best or s > best["score"]:
                best = cand
    return best if (best and best["score"] >= 6) else None


def main():
    print("Loading manifest + question banks...")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    books = manifest.get("books", [])
    seed_all = []
    for p in (SEED, GEN):
        if p.exists():
            d = json.loads(p.read_text(encoding="utf-8"))
            for q in d.get("questions", []):
                # 自动生成的已经带 textbook_ref — 仍走匹配以测引擎
                seed_all.append(q)
    print(f"Total questions: {len(seed_all)}  ·  Books: {len(books)}")

    by_subject = defaultdict(lambda: {"total": 0, "matched": 0, "scores": []})
    score_dist = Counter()
    misses = []
    t0 = time.time()
    for i, q in enumerate(seed_all):
        subj = q.get("subject", "?")
        by_subject[subj]["total"] += 1
        m = match_question(q, books)
        if m:
            by_subject[subj]["matched"] += 1
            by_subject[subj]["scores"].append(m["score"])
            score_dist[(m["score"] // 4) * 4] += 1
        else:
            if len(misses) < 50:
                misses.append({
                    "id": q.get("id"), "subject": subj, "chapter_hint": q.get("chapter"),
                    "knowledge_points": q.get("knowledge_points") or [],
                })
    dt = time.time() - t0
    total = len(seed_all)
    matched = sum(v["matched"] for v in by_subject.values())
    rate = matched / total if total else 0
    print(f"Matched: {matched}/{total} = {rate:.1%}  ({dt:.1f}s)")

    subj_report = {}
    for subj, v in sorted(by_subject.items()):
        r = v["matched"] / v["total"] if v["total"] else 0
        avg = sum(v["scores"]) / len(v["scores"]) if v["scores"] else 0
        subj_report[subj] = {
            "total": v["total"], "matched": v["matched"], "rate": round(r, 4),
            "avg_score": round(avg, 2),
        }
        print(f"  {SUBJ_MAP.get(subj, subj):<8} {v['matched']:>4}/{v['total']:<4}  {r:>6.1%}  avg score {avg:.1f}")

    report = {
        "engine_version": "v1.2-alias-3gram",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_questions": total,
        "total_books": len(books),
        "total_chapters": sum(len(b.get("chapters", [])) for b in books),
        "matched": matched,
        "match_rate": round(rate, 4),
        "elapsed_seconds": round(dt, 2),
        "by_subject": subj_report,
        "score_histogram": dict(sorted(score_dist.items())),
        "sample_misses": misses,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nReport saved: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
