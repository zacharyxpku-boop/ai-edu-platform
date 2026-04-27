# -*- coding: utf-8 -*-
"""
eval-rerank.py
在 ensemble (rules+BM25) 给的 top-5 候选之上，加一层 DeepSeek LLM 精排。

逻辑：
  1. 复用 eval-ensemble 的候选生成（subject 过滤 + BM25 top-K + rules 重打分）
  2. 取 ensemble_score 排序后的 top-5（如果首位已对，rerank 的"理论上限"是把所有错排扳到对位）
  3. 让 DeepSeek 看 (题目, 5 个候选章节标题)，从 5 个里选 1 个最贴的章节
  4. 算新的 r@1

输出：src/models/ensemble-rerank-report.json

用法：
  PYTHONIOENCODING=utf-8 python scripts/eval-rerank.py --sample 100   # 跑 100 题样本
  PYTHONIOENCODING=utf-8 python scripts/eval-rerank.py                 # 跑全量 843
"""
import io
import json
import os
import sys
import time
import argparse
import importlib.util
import urllib.request
import urllib.error
from pathlib import Path
from collections import defaultdict

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent

# 读 .env.local 里的 DEEPSEEK_API_KEY（不依赖 dotenv 包）
def _load_env():
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() not in os.environ:
            os.environ[k.strip()] = v.strip().strip('"').strip("'")
_load_env()

API_KEY = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_KEY")
if not API_KEY:
    print("缺 DEEPSEEK_API_KEY，去 .env.local 配一下")
    sys.exit(1)

API_URL = "https://api.deepseek.com/v1/chat/completions"
MODEL = "deepseek-chat"

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
ENS_REPORT = ROOT / "src" / "models" / "ensemble-recall-report.json"
OUT = ROOT / "src" / "models" / "ensemble-rerank-report.json"


def rules_score_for(ch_obj, q):
    s, _ = revlink.score_chapter(
        ch_obj.get("title") or "",
        q.get("subject"), q.get("chapter") or "",
        q.get("knowledge_points") or [],
    )
    return s


def call_deepseek(messages, max_retries=3):
    """同步调一次 DeepSeek，返回回复文本。失败重试 3 次"""
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.0,  # rerank 必须确定性
        "max_tokens": 50,    # 只要它输出 1-5 数字
        "stream": False,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(API_URL, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as r:
                resp = json.loads(r.read().decode("utf-8"))
                return resp["choices"][0]["message"]["content"].strip()
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    return ""


def build_rerank_prompt(question, candidates):
    """让 DeepSeek 在 5 个候选章节里选 1 个最贴的。返回 1-5 数字"""
    lines = [
        "你是一位资深 K12 教研老师。下面有一道题和 5 个候选教材章节。",
        "你的任务：判断这道题最对应的是哪一章。只输出一个数字 (1-5)，不要任何解释。",
        "",
        "题目：" + question[:400],
        "",
        "候选章节：",
    ]
    for i, c in enumerate(candidates):
        lines.append(f"{i+1}. {c.get('title','?')}（{c.get('path','')} 第 {c.get('ch','?')} 章）")
    lines.append("")
    lines.append("最对应的章节编号（只输出 1-5）：")
    return "\n".join(lines)


def parse_rerank_response(text, n_candidates):
    """从 DeepSeek 回复里提取 1-N 的数字"""
    import re
    m = re.search(r"\b([1-9])\b", text or "")
    if not m:
        return None
    n = int(m.group(1))
    if 1 <= n <= n_candidates:
        return n - 1  # 0-indexed
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0, help="只跑前 N 题样本（默认 0 = 全跑）")
    ap.add_argument("--top-k", type=int, default=5, help="rerank 输入候选数")
    args = ap.parse_args()

    print(f"Loading BM25 + manifest…  (sample={args.sample or 'all'}, top-k={args.top_k})")
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    books = manifest.get("books", [])
    book_by_path = {b["path"]: b for b in books}

    # 拿之前的 best_w_rules
    best_w = 5.0
    if ENS_REPORT.exists():
        ens = json.loads(ENS_REPORT.read_text(encoding="utf-8"))
        best_w = ens.get("best_w_rules", 5.0)
    print(f"Using best_w_rules = {best_w}")

    qs = []
    for p in (GEN, SEED):
        if p.exists():
            d = json.loads(p.read_text(encoding="utf-8"))
            for q in d.get("questions", []):
                ref = q.get("textbook_ref")
                if ref and ref.get("path") and ref.get("ch") is not None:
                    if ref.get("auto_tagged"):
                        continue
                    qs.append(q)
    if args.sample > 0:
        qs = qs[:args.sample]
    print(f"Eval set: {len(qs)} questions")

    # 先算每题的 ensemble top-5
    cache = []
    print("\n--- Phase 1: build ensemble top-5 candidates ---")
    for i, q in enumerate(qs):
        zh = bm25.SUBJ_MAP.get(q.get("subject"))
        ref = q["textbook_ref"]
        gold = (ref["path"], ref["ch"])
        qtxt = (q.get("question_text") or "")[:80] + " " + " ".join(q.get("knowledge_points") or [])
        bm_top = bm25.query_bm25(idx, qtxt, subject=zh, k=args.top_k * 2)  # 多拿点候选
        candidates = []
        for r in bm_top:
            b = book_by_path.get(r["path"])
            if not b: continue
            ch_obj = next((c for c in b.get("chapters", []) if c.get("ch") == r["ch"]), None)
            if not ch_obj: continue
            rscore = rules_score_for(ch_obj, q)
            candidates.append({
                "path": r["path"], "ch": r["ch"], "title": ch_obj.get("title", ""),
                "bm25": r["score"], "rules": rscore,
                "ensemble_score": r["score"] + best_w * rscore,
            })
        candidates.sort(key=lambda x: -x["ensemble_score"])
        candidates = candidates[:args.top_k]
        cache.append({"q": q, "gold": gold, "candidates": candidates})
        if (i+1) % 50 == 0:
            print(f"  built {i+1}/{len(qs)}")

    # ensemble baseline
    ens_r1 = sum(1 for c in cache if c["candidates"] and (c["candidates"][0]["path"], c["candidates"][0]["ch"]) == c["gold"])
    ens_r5 = sum(1 for c in cache if any((cd["path"], cd["ch"]) == c["gold"] for cd in c["candidates"]))
    N = len(cache)
    print(f"\n  baseline ensemble r@1 = {ens_r1}/{N} = {ens_r1/N:.1%}")
    print(f"  baseline ensemble r@5 = {ens_r5}/{N} = {ens_r5/N:.1%}  (rerank ceiling)")

    # Phase 2: DeepSeek rerank
    print(f"\n--- Phase 2: DeepSeek rerank top-{args.top_k} ---")
    print(f"  预计调用 {N} 次 DeepSeek，串行 ~{N*1.2/60:.1f} 分钟")
    t0 = time.time()
    rerank_hits = 0
    rerank_failed = 0
    rerank_changes = 0  # 跟 ensemble 选不同位置
    rerank_kept = 0     # 跟 ensemble 选同位置（既有正确又有 rerank 没改）
    fix_cnt = 0         # ensemble 错 rerank 改对
    break_cnt = 0       # ensemble 对 rerank 改错

    for i, c in enumerate(cache):
        if not c["candidates"]:
            rerank_failed += 1
            continue
        ens_pick = (c["candidates"][0]["path"], c["candidates"][0]["ch"])
        ens_correct = ens_pick == c["gold"]
        question_text = (c["q"].get("question_text") or "")
        prompt = build_rerank_prompt(question_text, c["candidates"])
        try:
            resp = call_deepseek([{"role": "user", "content": prompt}])
            picked_idx = parse_rerank_response(resp, len(c["candidates"]))
            if picked_idx is None:
                rerank_failed += 1
                continue
            picked = c["candidates"][picked_idx]
            picked_pos = (picked["path"], picked["ch"])
            picked_correct = picked_pos == c["gold"]
            if picked_idx == 0:
                rerank_kept += 1
            else:
                rerank_changes += 1
            if picked_correct:
                rerank_hits += 1
            if (not ens_correct) and picked_correct:
                fix_cnt += 1
            if ens_correct and (not picked_correct):
                break_cnt += 1
        except Exception as e:
            rerank_failed += 1
            print(f"    [{i+1}] LLM error: {e}")
        if (i+1) % 25 == 0:
            elapsed = time.time() - t0
            rate = (i+1) / elapsed
            eta = (N - i - 1) / rate if rate > 0 else 0
            print(f"  {i+1}/{N}  hits={rerank_hits}  fix={fix_cnt}  break={break_cnt}  ({rate:.1f}/s · ETA {eta/60:.1f}min)")

    dt = time.time() - t0
    print(f"\n=== Rerank result ===")
    print(f"  rerank r@1: {rerank_hits}/{N} = {rerank_hits/N:.1%}")
    print(f"  ensemble r@1: {ens_r1}/{N} = {ens_r1/N:.1%}")
    print(f"  lift: {(rerank_hits - ens_r1)/N*100:+.1f}pp")
    print(f"  改变首位: {rerank_changes} 次  保持首位: {rerank_kept} 次")
    print(f"  把错改对（救回）: {fix_cnt}  把对改错（误伤）: {break_cnt}")
    print(f"  失败: {rerank_failed}  耗时: {dt:.0f}s ({dt/60:.1f}min)")

    report = {
        "model": "ensemble-rules+bm25-v1 + deepseek-rerank",
        "rerank_model": MODEL,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "elapsed_seconds": round(dt, 2),
        "eval_set": N,
        "sample_mode": args.sample > 0,
        "top_k_input": args.top_k,
        "best_w_rules": best_w,
        "recall_at_1": {
            "ensemble_baseline": round(ens_r1 / N, 4) if N else 0,
            "with_rerank": round(rerank_hits / N, 4) if N else 0,
        },
        "recall_at_5_baseline": round(ens_r5 / N, 4) if N else 0,
        "rerank_lift_pp": round((rerank_hits - ens_r1) / N * 100, 2) if N else 0,
        "rerank_actions": {
            "kept_position": rerank_kept,
            "changed_position": rerank_changes,
            "fixed_wrong_to_right": fix_cnt,
            "broke_right_to_wrong": break_cnt,
            "llm_failed": rerank_failed,
        },
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nReport: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
