# -*- coding: utf-8 -*-
"""
eval-ensemble.py
两条独立路径融合：rules engine（chapter-match 打分）+ BM25 检索模型，
线性加权 rerank BM25 top-K，看 recall@1 能不能比单引擎更准。

设计：
  · BM25 给候选（recall 高，找得回）
  · rules engine 给精排（precision 高，alias/kp 命中能摧毁错的）
  · final = bm25.score + w_r * rules.score   （w_r 扫一组找最佳）

输出：src/models/ensemble-recall-report.json
"""
import io
import json
import sys
import time
import importlib.util
from collections import defaultdict
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


revlink = _load("revlink", ROOT / "scripts" / "eval-reverse-link.py")
bm25 = _load("bm25eval", ROOT / "scripts" / "eval-bm25-recall.py")

INDEX = ROOT / "src" / "models" / "chapter-bm25.json"
MANIFEST = ROOT / "data" / "extracted" / "manifest.json"
GEN = ROOT / "src" / "curriculum" / "seed-questions-generated.json"
SEED = ROOT / "src" / "curriculum" / "seed-questions.json"
OUT = ROOT / "src" / "models" / "ensemble-recall-report.json"


def rules_score_for(ch_obj, q):
    subj = q.get("subject")
    hint = q.get("chapter") or ""
    kps = q.get("knowledge_points") or []
    s, _ = revlink.score_chapter(ch_obj.get("title") or "", subj, hint, kps)
    return s


def main():
    print("Loading BM25 index + manifest…")
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    books = manifest.get("books", [])
    book_by_path = {b["path"]: b for b in books}

    qs = []
    auto = 0
    for p in (GEN, SEED):
        if p.exists():
            d = json.loads(p.read_text(encoding="utf-8"))
            for q in d.get("questions", []):
                ref = q.get("textbook_ref")
                if ref and ref.get("path") and ref.get("ch") is not None:
                    if ref.get("auto_tagged"):
                        auto += 1
                        continue  # 自动打标不当 gold
                    qs.append(q)
    print(f"Eval set: {len(qs)} gold questions  ·  skipped auto_tagged: {auto}")

    cache = []
    t0 = time.time()
    for q in qs:
        zh = bm25.SUBJ_MAP.get(q.get("subject"))
        ref = q["textbook_ref"]
        gold = (ref["path"], ref["ch"])
        qtxt = (q.get("question_text") or "")[:80] + " " + " ".join(q.get("knowledge_points") or [])
        bm_top = bm25.query_bm25(idx, qtxt, subject=zh, k=5)
        rules_best = revlink.match_question(q, books)
        rules_pred = (rules_best["path"], rules_best["ch"]) if rules_best else None

        candidates = []
        for r in bm_top:
            b = book_by_path.get(r["path"])
            if not b:
                continue
            ch_obj = next((c for c in b.get("chapters", []) if c.get("ch") == r["ch"]), None)
            if not ch_obj:
                continue
            rscore = rules_score_for(ch_obj, q)
            candidates.append({"path": r["path"], "ch": r["ch"], "bm25": r["score"], "rules": rscore})
        # 把 rules 预测也丢进候选池里（如果 BM25 漏了它）
        if rules_pred and not any((c["path"], c["ch"]) == rules_pred for c in candidates):
            b = book_by_path.get(rules_pred[0])
            if b:
                ch_obj = next((c for c in b.get("chapters", []) if c.get("ch") == rules_pred[1]), None)
                if ch_obj:
                    candidates.append({
                        "path": rules_pred[0], "ch": rules_pred[1],
                        "bm25": 0.0, "rules": rules_score_for(ch_obj, q),
                    })
        cache.append({
            "q": q, "gold": gold, "rules_pred": rules_pred,
            "bm_top": [(r["path"], r["ch"]) for r in bm_top],
            "candidates": candidates,
        })
    dt = time.time() - t0

    N = len(cache)
    rules_r1 = sum(1 for c in cache if c["rules_pred"] == c["gold"])
    bm_r1 = sum(1 for c in cache if c["bm_top"][:1] and c["bm_top"][0] == c["gold"])
    bm_r5 = sum(1 for c in cache if c["gold"] in c["bm_top"][:5])
    print(f"\n  rules-only recall@1: {rules_r1}/{N} = {rules_r1/N:.1%}")
    print(f"  bm25-only  recall@1: {bm_r1}/{N} = {bm_r1/N:.1%}")
    print(f"  bm25-only  recall@5: {bm_r5}/{N} = {bm_r5/N:.1%}")

    weights = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 2.0, 3.0, 5.0]
    print(f"\nSweep w_rules: {weights}")
    sweep = []
    best = {"w": None, "r1": -1}
    for w in weights:
        hit = 0
        for c in cache:
            cands = c["candidates"]
            if not cands:
                if c["rules_pred"] == c["gold"]:
                    hit += 1
                continue
            best_cand = max(cands, key=lambda x: x["bm25"] + w * x["rules"])
            if (best_cand["path"], best_cand["ch"]) == c["gold"]:
                hit += 1
        rate = hit / N
        sweep.append({"w_rules": w, "ensemble_r1": round(rate, 4)})
        marker = ""
        if rate > best["r1"]:
            best = {"w": w, "r1": rate}
            marker = "  ←"
        print(f"  w_rules={w:>4.1f}  ensemble r@1: {hit}/{N} = {rate:.1%}{marker}")

    print(f"\n  → best w_rules = {best['w']}  ensemble r@1 = {best['r1']:.1%}")
    print(f"  lift over rules: {(best['r1'] - rules_r1/N)*100:+.1f}pp · over bm25: {(best['r1'] - bm_r1/N)*100:+.1f}pp")

    # 用最佳 w 收 by_subject
    by_subject = defaultdict(lambda: {"total": 0, "rules_r1": 0, "bm25_r1": 0, "ens_r1": 0})
    for c in cache:
        subj = c["q"].get("subject")
        v = by_subject[subj]
        v["total"] += 1
        if c["rules_pred"] == c["gold"]:
            v["rules_r1"] += 1
        if c["bm_top"][:1] and c["bm_top"][0] == c["gold"]:
            v["bm25_r1"] += 1
        cands = c["candidates"]
        if cands:
            best_cand = max(cands, key=lambda x: x["bm25"] + best["w"] * x["rules"])
            if (best_cand["path"], best_cand["ch"]) == c["gold"]:
                v["ens_r1"] += 1
        elif c["rules_pred"] == c["gold"]:
            v["ens_r1"] += 1

    by_subject_out = {}
    print("\n  学科     rules     bm25     ensemble  N")
    for subj, v in sorted(by_subject.items()):
        rr = v["rules_r1"] / v["total"] if v["total"] else 0
        br = v["bm25_r1"] / v["total"] if v["total"] else 0
        er = v["ens_r1"] / v["total"] if v["total"] else 0
        zh = bm25.SUBJ_MAP.get(subj, subj)
        print(f"  {zh:<8} {rr:>6.1%}   {br:>6.1%}   {er:>6.1%}   {v['total']}")
        by_subject_out[subj] = {
            "total": v["total"], "rules_r1": v["rules_r1"], "bm25_r1": v["bm25_r1"], "ens_r1": v["ens_r1"],
            "rules_rate": round(rr, 4), "bm25_rate": round(br, 4), "ens_rate": round(er, 4),
        }

    report = {
        "model": "ensemble-rules+bm25-v1",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "elapsed_seconds": round(dt, 2),
        "eval_set": N,
        "best_w_rules": best["w"],
        "recall_at_1": {
            "rules_only": round(rules_r1 / N, 4),
            "bm25_only": round(bm_r1 / N, 4),
            "ensemble": round(best["r1"], 4),
        },
        "recall_at_5_bm25": round(bm_r5 / N, 4),
        "lift_over_bm25_r1": round(best["r1"] - bm_r1 / N, 4),
        "lift_over_rules_r1": round(best["r1"] - rules_r1 / N, 4),
        "weight_sweep": sweep,
        "by_subject": by_subject_out,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nReport: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
