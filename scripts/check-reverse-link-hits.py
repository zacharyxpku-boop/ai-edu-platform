# -*- coding: utf-8 -*-
"""
Audit arcade 反链命中率：把 knowledge-arcade.html 的 matchTextbookChapter 打分规则用 Python 复刻一遍，
跑 seed-questions.json 100 题，输出每题命中的 book/ch 或 miss 理由，统计 hit%。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
M = json.load(open(ROOT / "data/extracted/manifest.json", encoding="utf-8"))
S = json.load(open(ROOT / "src/curriculum/seed-questions.json", encoding="utf-8"))

SUBJ = {"math": "数学", "physics": "物理", "chemistry": "化学"}


def score_and_match(subject_en, q):
    zh = SUBJ.get(subject_en)
    if not zh:
        return None, 0
    hint = (q.get("chapter") or "").strip()
    kps = [str(k).strip() for k in q.get("knowledge_points", []) if k]
    books = [b for b in M["books"] if b["subject"] == zh]
    best, best_score = None, 0
    for b in books:
        for c in b.get("chapters", []):
            title = str(c.get("title") or "")
            score = 0
            if hint and hint in title:
                score += 12
            elif hint and len(hint) >= 3:
                for i in range(len(hint) - 2):
                    if hint[i:i+3] in title:
                        score += 4
                        break
            for k in kps:
                if k and k in title:
                    score += 6
                elif k and len(k) >= 3 and k[:3] in title:
                    score += 2
            if score > best_score:
                best_score = score
                best = (b, c)
    return best, best_score


def main():
    hits_strong, hits_weak, miss = 0, 0, 0
    subj_totals = {"math": [0, 0, 0], "physics": [0, 0, 0], "chemistry": [0, 0, 0]}  # [strong, weak, miss]
    for q in S["questions"]:
        m, sc = score_and_match(q["subject"], q)
        row = subj_totals[q["subject"]]
        if m and sc >= 6:
            hits_strong += 1
            row[0] += 1
        elif m:
            hits_weak += 1
            row[1] += 1
        else:
            miss += 1
            row[2] += 1
    total = len(S["questions"])
    print(f"\n=== 反链打分审计（N={total}）===")
    print(f"  强命中 (score>=6): {hits_strong} ({hits_strong/total*100:.0f}%)")
    print(f"  弱命中 (score>0):  {hits_weak}")
    print(f"  零命中:            {miss}")
    for k, v in subj_totals.items():
        tot = sum(v)
        if tot:
            print(f"  {SUBJ[k]:<3} {v[0]}/{tot} 强  {v[1]}/{tot} 弱  {v[2]}/{tot} 零")

    # 详细 zero-hit 清单（最能揭示 gap）
    print("\n=== 零命中题（最多 20 道）===")
    n = 0
    for q in S["questions"]:
        m, sc = score_and_match(q["subject"], q)
        if sc > 0:
            continue
        if n >= 20:
            print(f"  ...还有更多"); break
        n += 1
        kps = "/".join(q.get("knowledge_points", [])[:3])
        chp = q.get("chapter", "")
        try:
            print(f"  {q['id']:<22} {SUBJ[q['subject']]} {q['grade']} 章={chp}  kp={kps}")
        except UnicodeEncodeError:
            s = f"  {q['id']:<22} {SUBJ[q['subject']]} {q['grade']} 章={chp}  kp={kps}"
            print(s.encode('gbk', errors='replace').decode('gbk', errors='replace'))


if __name__ == "__main__":
    main()
