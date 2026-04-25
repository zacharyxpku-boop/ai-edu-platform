# -*- coding: utf-8 -*-
"""
auto-tag-textbook-ref.py
用 ensemble 引擎（BM25 + rules）给 seed-questions.json 里没 textbook_ref 的题
自动补 textbook_ref，写回原文件（先备份 .pre-autotag.json）。

策略：跑 ensemble 拿 top-1 候选，过两道闸门才接受：
  · rules_score ≥ 6（与 reverse-link 主阈值一致）
  · 或 bm25_score ≥ 8（语义检索强相关）
否则该题留空，避免污染数据。

跑完会再调用 eval-reverse-link.py 重算，看反链命中率有没有上升。
"""
import io
import json
import shutil
import sys
import time
import importlib.util
from collections import Counter
from pathlib import Path

if hasattr(sys.stdout, "buffer") and sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "curriculum" / "seed-questions.json"
BACKUP = ROOT / "src" / "curriculum" / "seed-questions.pre-autotag.json"
INDEX = ROOT / "src" / "models" / "chapter-bm25.json"
MANIFEST = ROOT / "data" / "extracted" / "manifest.json"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


revlink = _load("revlink", ROOT / "scripts" / "eval-reverse-link.py")
bm25 = _load("bm25eval", ROOT / "scripts" / "eval-bm25-recall.py")


W_RULES = 5.0
RULES_GATE = 6
BM25_GATE = 8.0


def main():
    dry = "--dry" in sys.argv
    print(f"Loading BM25 + manifest…  (dry={dry})")
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    books = manifest.get("books", [])
    book_by_path = {b["path"]: b for b in books}

    data = json.loads(SEED.read_text(encoding="utf-8"))
    questions = data.get("questions", [])
    print(f"Seed questions: {len(questions)}")

    # 先备份
    if not dry and not BACKUP.exists():
        shutil.copy(SEED, BACKUP)
        print(f"Backup → {BACKUP.relative_to(ROOT)}")

    tagged = 0
    skipped_no_query = 0
    skipped_low_conf = 0
    by_subject = Counter()
    sample_tags = []
    sample_skips = []
    t0 = time.time()

    for q in questions:
        if q.get("textbook_ref"):
            continue
        subj = q.get("subject")
        zh = bm25.SUBJ_MAP.get(subj)
        if not zh:
            skipped_no_query += 1
            continue
        qtxt = (q.get("question_text") or "")[:80] + " " \
             + " ".join(q.get("knowledge_points") or []) + " " \
             + (q.get("chapter") or "")
        if not qtxt.strip():
            skipped_no_query += 1
            continue

        bm_top = bm25.query_bm25(idx, qtxt, subject=zh, k=5)
        candidates = []
        for r in bm_top:
            b = book_by_path.get(r["path"])
            if not b:
                continue
            ch_obj = next((c for c in b.get("chapters", []) if c.get("ch") == r["ch"]), None)
            if not ch_obj:
                continue
            rs, _ = revlink.score_chapter(
                ch_obj.get("title") or "", subj, q.get("chapter") or "", q.get("knowledge_points") or [])
            candidates.append({
                "path": r["path"], "ch": r["ch"], "title": ch_obj.get("title"),
                "bm25": r["score"], "rules": rs,
                "ensemble": r["score"] + W_RULES * rs,
            })
        # 也把 rules engine 强匹配的章节丢进候选池
        rules_pred = revlink.match_question(q, books)
        if rules_pred and not any((c["path"], c["ch"]) == (rules_pred["path"], rules_pred["ch"]) for c in candidates):
            candidates.append({
                "path": rules_pred["path"], "ch": rules_pred["ch"], "title": rules_pred["title"],
                "bm25": 0.0, "rules": rules_pred["score"],
                "ensemble": W_RULES * rules_pred["score"],
            })
        if not candidates:
            skipped_no_query += 1
            sample_skips.append({"id": q.get("id"), "reason": "no_candidates", "q": qtxt[:50]})
            continue
        candidates.sort(key=lambda x: -x["ensemble"])
        top = candidates[0]
        # 信心闸门
        accept = top["rules"] >= RULES_GATE or top["bm25"] >= BM25_GATE
        if not accept:
            skipped_low_conf += 1
            if len(sample_skips) < 20:
                sample_skips.append({
                    "id": q.get("id"), "reason": "low_confidence",
                    "top_rules": top["rules"], "top_bm25": round(top["bm25"], 2),
                    "title": top["title"], "q": qtxt[:50],
                })
            continue
        # 写入
        q["textbook_ref"] = {
            "path": top["path"], "ch": top["ch"],
            "auto_tagged": True, "engine": "ensemble-rules+bm25-v1",
            "rules_score": top["rules"], "bm25_score": round(top["bm25"], 2),
        }
        tagged += 1
        by_subject[subj] += 1
        if len(sample_tags) < 10:
            sample_tags.append({"id": q.get("id"), "title": top["title"],
                                "rules": top["rules"], "bm25": round(top["bm25"], 2)})

    dt = time.time() - t0
    print(f"\nTagged: {tagged}/{sum(1 for q in questions if not q.get('textbook_ref') or q.get('textbook_ref',{}).get('auto_tagged'))}  ({dt:.1f}s)")
    print(f"Skipped no query/candidates: {skipped_no_query}")
    print(f"Skipped low confidence: {skipped_low_conf}")
    print("\nBy subject:")
    for s, n in sorted(by_subject.items()):
        print(f"  {bm25.SUBJ_MAP.get(s, s):<8} +{n}")

    print("\nSample auto-tagged:")
    for s in sample_tags:
        print(f"  {s['id']} → {s['title']}  (rules={s['rules']} bm25={s['bm25']})")
    print("\nSample skipped (low conf):")
    for s in sample_skips[:5]:
        if s.get("reason") == "low_confidence":
            print(f"  {s['id']} top: {s.get('title','?')}  rules={s.get('top_rules','?')} bm25={s.get('top_bm25','?')}  q={s['q']}")

    if dry:
        print("\n(dry run, not writing)")
        return

    # 加 meta 注释
    data.setdefault("meta", {})
    data["meta"].setdefault("auto_tag_runs", []).append({
        "ran_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "engine": "ensemble-rules+bm25-v1",
        "tagged": tagged,
        "rules_gate": RULES_GATE, "bm25_gate": BM25_GATE,
    })
    SEED.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nUpdated: {SEED.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
