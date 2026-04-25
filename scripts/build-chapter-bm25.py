# -*- coding: utf-8 -*-
"""
build-chapter-bm25.py
原点自研「章节检索模型 v1 · BM25-jieba」构建脚本。

为什么不走 embedding：272 章 × jieba 分词后 vocab 约 3-5 万词，BM25 索引一次性几 MB，
edge runtime 直接 JSON.parse 后 in-memory 打分，0 token，<50ms，比一般 vector DB 便宜。

输出：
  src/models/chapter-bm25.json
    · meta: 参数 k1 b · 语料统计 · engine_version
    · docs: 272 条 · 每条 {id, path, ch, title, subject, stage, len, tf:{term:count}}
    · idf: {term: idf-weight}
    · vocab_ngram: {bigram|trigram: [term1, term2, ...]}  供前端 char-ngram 查询拼回词项

用法：
  python scripts/build-chapter-bm25.py
  python scripts/build-chapter-bm25.py --sample  # 只构 10 章试跑
"""
import io
import json
import math
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import jieba

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "data" / "extracted"
MANIFEST = EXT / "manifest.json"
OUT = ROOT / "src" / "models" / "chapter-bm25.json"

# BM25 超参 · Robertson 1994 默认
K1 = 1.5
B = 0.75

# 停用字（高频无语义 token）— 保留专有名词
STOP = set("的了在是和与或有为以及这个那这些那些一种一些各种任何所有某些"
           "通过根据由于因此所以然后接着最后首先其次再者也都但但是而且"
           "一二三四五六七八九十百千万")
MIN_TERM_LEN = 2
MIN_TERM_DF = 2  # 至少出现在 2 章才收
MAX_TERMS_PER_DOC = 400  # 每章只存 top-400 TF 项，控索引体积


def tokenize(text: str):
    """jieba 分词 + 过滤停用/短词/纯数字/纯英文单字母。"""
    if not text:
        return []
    toks = []
    for w in jieba.cut(text):
        w = w.strip()
        if not w or len(w) < MIN_TERM_LEN:
            continue
        if w in STOP:
            continue
        # 纯数字/纯符号跳过
        if re.match(r"^[\d\s\W_]+$", w):
            continue
        # 含中文或字母组合才要
        if re.search(r"[\u4e00-\u9fa5A-Za-z]", w):
            toks.append(w)
    return toks


def ngram_index(terms):
    """为每个词建 char 2-gram / 3-gram 反查，让前端 query 用 n-gram 找回词项。"""
    idx = defaultdict(set)
    for t in terms:
        s = t
        if len(s) < 2:
            continue
        for n in (2, 3):
            if len(s) < n:
                continue
            for i in range(len(s) - n + 1):
                g = s[i:i + n]
                idx[g].add(t)
    return idx


def main():
    sample = "--sample" in sys.argv
    t0 = time.time()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    books = manifest.get("books", [])

    print("Tokenizing chapters…")
    docs = []
    df = Counter()  # document frequency per term
    total_len = 0
    skipped = 0

    tasks = []
    for b in books:
        for c in b.get("chapters", []):
            tasks.append((b, c))
    if sample:
        tasks = tasks[:10]

    for idx, (b, c) in enumerate(tasks):
        p = EXT / b["path"] / f"ch{c['ch']}.json"
        if not p.exists():
            skipped += 1
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            skipped += 1
            continue
        text = (d.get("text") or "").strip()
        title = c.get("title") or d.get("title") or ""
        # title 权重 ×3：title 重复 3 次拼进文本提升章标题权重
        corpus_text = (title + " ") * 3 + text
        toks = tokenize(corpus_text)
        if not toks:
            skipped += 1
            continue
        tf = Counter(toks)
        # 截断到 top-N 防止存全字典
        if len(tf) > MAX_TERMS_PER_DOC:
            kept = dict(tf.most_common(MAX_TERMS_PER_DOC))
            tf = kept
        for t in tf.keys():
            df[t] += 1
        docs.append({
            "id": f"{b['path']}#ch{c['ch']}",
            "path": b["path"],
            "ch": c["ch"],
            "title": title,
            "subject": b.get("subject"),
            "stage": b.get("stage"),
            "grade": b.get("grade"),
            "volume": b.get("volume"),
            "len": sum(tf.values()),
            "tf": dict(tf),
        })
        total_len += sum(tf.values())
        if (idx + 1) % 50 == 0:
            print(f"  tokenized {idx + 1}/{len(tasks)}")

    # 过滤 df < MIN_TERM_DF
    kept_terms = {t for t, c in df.items() if c >= MIN_TERM_DF}
    print(f"Vocab raw: {len(df)} · kept (df>={MIN_TERM_DF}): {len(kept_terms)}")

    # 每章 tf 也过滤
    for d in docs:
        d["tf"] = {t: c for t, c in d["tf"].items() if t in kept_terms}
        d["len"] = sum(d["tf"].values())

    N = len(docs)
    avgdl = (total_len / N) if N else 0

    # IDF · Robertson-Sparck Jones, BM25 的 (N - df + 0.5)/(df + 0.5)
    idf = {}
    for t in kept_terms:
        n = df[t]
        idf[t] = max(0.01, math.log((N - n + 0.5) / (n + 0.5) + 1))

    # n-gram → term 反查
    ng_idx = ngram_index(kept_terms)
    # set → sorted list 方便 JSON
    ng_idx_out = {g: sorted(list(ts))[:12] for g, ts in ng_idx.items() if len(ts) > 0}
    # 体积控制：ngram 表限制长度，每 gram 最多 12 词

    out = {
        "model": "chapter-bm25-v1",
        "engine_version": "bm25-jieba-v1.0",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "built_in_seconds": round(time.time() - t0, 2),
        "params": {"k1": K1, "b": B, "min_term_len": MIN_TERM_LEN,
                   "min_term_df": MIN_TERM_DF, "max_terms_per_doc": MAX_TERMS_PER_DOC},
        "stats": {
            "docs": N, "avg_doclen": round(avgdl, 1),
            "vocab_size": len(kept_terms), "skipped": skipped,
            "ngram_keys": len(ng_idx_out),
        },
        "idf": idf,
        "docs": docs,
        "vocab_ngram": ng_idx_out,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    sz = OUT.stat().st_size
    print(f"\nSaved: {OUT.relative_to(ROOT)}  ({sz/1024:.1f} KB)")
    print(f"Docs={N}  vocab={len(kept_terms)}  avgdl={avgdl:.1f}  ngrams={len(ng_idx_out)}")
    print(f"Total build time: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
