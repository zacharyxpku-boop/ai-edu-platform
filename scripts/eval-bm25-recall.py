# -*- coding: utf-8 -*-
"""
eval-bm25-recall.py
跑 BM25 检索模型在 843 道带 textbook_ref 的生成题上的 recall@1/3/5。

每题用题干 + knowledge_points 作为 query → BM25 → 看正确章节是否在 top-K。
结果写 src/models/bm25-recall-report.json，platform.html 同步显示。
"""
import io
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

if __name__ == "__main__" and hasattr(sys.stdout, "buffer") and sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "src" / "models" / "chapter-bm25.json"
GEN = ROOT / "src" / "curriculum" / "seed-questions-generated.json"
SEED = ROOT / "src" / "curriculum" / "seed-questions.json"
OUT = ROOT / "src" / "models" / "bm25-recall-report.json"


def query_bm25(idx, q, subject=None, k=5):
    docs = idx["docs"]
    idfm = idx["idf"]
    ngm = idx["vocab_ngram"]
    avgdl = idx["stats"]["avg_doclen"]
    k1 = idx["params"]["k1"]
    b = idx["params"]["b"]
    seen, terms = set(), {}
    q = (q or "").replace(" ", "")
    for n in (2, 3):
        if len(q) < n:
            continue
        for i in range(0, len(q) - n + 1):
            g = q[i:i + n]
            if g in seen:
                continue
            seen.add(g)
            for t in ngm.get(g, []):
                terms[t] = terms.get(t, 0) + 1
    if not terms:
        return []
    res = []
    for d in docs:
        if subject and d.get("subject") != subject:
            continue
        s = 0
        dl = d["len"] or 1
        tf = d.get("tf", {})
        for t, h in terms.items():
            f = tf.get(t, 0)
            if not f:
                continue
            w = idfm.get(t, 0)
            norm = f * (k1 + 1) / (f + k1 * (1 - b + b * dl / avgdl))
            qf = min(1, h / (len(t) or 2))
            s += w * norm * (0.5 + 0.5 * qf)
        if s > 0.5:
            res.append({"score": s, "path": d["path"], "ch": d["ch"], "title": d.get("title")})
    res.sort(key=lambda x: -x["score"])
    return res[:k]


SUBJ_MAP = {
    "math": "数学", "physics": "物理", "chemistry": "化学", "biology": "生物学",
    "chinese": "语文", "english": "英语", "history": "历史", "geography": "地理",
    "politics": "思想政治", "moral": "道德与法治",
}


def main():
    print("Loading BM25 index…")
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    print(f"  {idx['stats']['docs']} docs · {idx['stats']['vocab_size']} vocab")

    qs = []
    for p in (GEN, SEED):
        if p.exists():
            d = json.loads(p.read_text(encoding="utf-8"))
            for q in d.get("questions", []):
                ref = q.get("textbook_ref")
                if ref and ref.get("path") and ref.get("ch") is not None:
                    qs.append(q)
    print(f"Eval set (with textbook_ref): {len(qs)}")

    counters = {1: 0, 3: 0, 5: 0}
    by_subject = defaultdict(lambda: {"total": 0, **{f"r{k}": 0 for k in (1, 3, 5)}})
    miss = []
    t0 = time.time()
    for q in qs:
        subj = q.get("subject")
        zh = SUBJ_MAP.get(subj)
        ref = q["textbook_ref"]
        gold = (ref["path"], ref["ch"])
        # query：题干前 80 字 + kps
        qtxt = (q.get("question_text") or "")[:80] + " " + " ".join(q.get("knowledge_points") or [])
        results = query_bm25(idx, qtxt, subject=zh, k=5)
        ranks = [(r["path"], r["ch"]) for r in results]
        by_subject[subj]["total"] += 1
        if gold in ranks[:1]:
            counters[1] += 1
            by_subject[subj]["r1"] += 1
        if gold in ranks[:3]:
            counters[3] += 1
            by_subject[subj]["r3"] += 1
        if gold in ranks[:5]:
            counters[5] += 1
            by_subject[subj]["r5"] += 1
        else:
            if len(miss) < 30:
                miss.append({
                    "id": q.get("id"), "subject": subj,
                    "gold_path": ref["path"], "gold_ch": ref["ch"],
                    "top1": ranks[0] if ranks else None,
                })
    dt = time.time() - t0

    N = len(qs)
    print(f"\nRecall over {N} questions  ({dt:.1f}s)")
    for k in (1, 3, 5):
        print(f"  recall@{k}: {counters[k]}/{N} = {counters[k]/N:.1%}")
    print()
    for subj, v in sorted(by_subject.items()):
        r1 = v["r1"] / v["total"] if v["total"] else 0
        r5 = v["r5"] / v["total"] if v["total"] else 0
        print(f"  {SUBJ_MAP.get(subj, subj):<8} N={v['total']:<4}  r@1={r1:>6.1%}  r@5={r5:>6.1%}")

    report = {
        "model": idx.get("model"),
        "engine_version": idx.get("engine_version"),
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "elapsed_seconds": round(dt, 2),
        "eval_set": N,
        "recall": {
            "at_1": round(counters[1] / N, 4) if N else 0,
            "at_3": round(counters[3] / N, 4) if N else 0,
            "at_5": round(counters[5] / N, 4) if N else 0,
        },
        "by_subject": {k: {**v, "rate_at_1": round(v["r1"] / v["total"], 4) if v["total"] else 0,
                            "rate_at_5": round(v["r5"] / v["total"], 4) if v["total"] else 0}
                       for k, v in by_subject.items()},
        "sample_misses": miss,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nReport: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
