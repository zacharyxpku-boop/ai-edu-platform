# -*- coding: utf-8 -*-
"""
extract-chapters.py
把已下载的 textbook PDF 拆成按章节的 JSON。

用法：
    python scripts/extract-chapters.py 初中 数学 人教版 七年级 上册
    python scripts/extract-chapters.py --all-downloaded

输出：
    data/extracted/<stage>/<subject>/<edition>/<grade>/<volume>/
        meta.json          — 整本书元数据 + 章节目录
        ch1.json           — 第一章全文 + 小节结构
        ch2.json ...

数学教材 TOC 为空 -> 基于字体大小启发式识别章节标题（size ≥ 60pt）与小节（size ≥ 24pt）。
"""
import argparse
import json
import re
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "textbooks-raw"
OUT_DIR = ROOT / "data" / "extracted"

CHAPTER_RE = re.compile(r"第([一二三四五六七八九十]+)(?:章|单元)")
# 支持 ASCII "1.1" 也支持全角 "１．１"
SECTION_RE = re.compile(
    r"^\s*([1-9１-９]\d?[.．][1-9１-９]\d?(?:[.．][1-9１-９]\d?)?)"
)


def normalize_section_code(code: str) -> str:
    """全角数字与句点转 ASCII。"""
    trans = str.maketrans("１２３４５６７８９０．", "1234567890.")
    return code.translate(trans)

# 中文数字 -> 阿拉伯
ZH_NUM = {"一":1, "二":2, "三":3, "四":4, "五":5, "六":6, "七":7, "八":8, "九":9, "十":10,
          "十一":11, "十二":12}


def zh_to_int(s: str) -> int:
    if s in ZH_NUM:
        return ZH_NUM[s]
    if s.startswith("十"):
        return 10 + ZH_NUM.get(s[1:], 0)
    if s.endswith("十"):
        return ZH_NUM.get(s[:1], 0) * 10
    if "十" in s:
        parts = s.split("十")
        return ZH_NUM.get(parts[0], 1) * 10 + ZH_NUM.get(parts[1], 0)
    return 0


def extract_spans(page):
    """返回 [(size, text, bbox)] 按字号排好。"""
    d = page.get_text("dict")
    items = []
    for block in d.get("blocks", []):
        if block.get("type") != 0: continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans: continue
            txt = "".join(s["text"] for s in spans).strip()
            if not txt: continue
            size = max(s["size"] for s in spans)
            items.append((size, txt, line["bbox"]))
    return items


def find_chapters(doc, min_title_size=60.0):
    """基于字号识别章节标题页。返回 [(page_index_0based, ch_num, title_text)]"""
    cand = {}
    for i in range(doc.page_count):
        for size, txt, _ in extract_spans(doc[i]):
            if size < min_title_size: continue
            m = CHAPTER_RE.search(txt)
            if not m: continue
            ch = zh_to_int(m.group(1))
            if ch == 0: continue
            prev = cand.get(ch)
            if prev is None or size > prev[1]:
                cand[ch] = (i, size, txt)
    out = []
    for ch in sorted(cand.keys()):
        pg, sz, title = cand[ch]
        out.append((pg, ch, title))
    return out


def find_chapters_relaxed(doc, min_size=20.0):
    """物理/化学教材：字号只到 36pt 左右，用「页上仅 1 个章节号」区分 TOC vs 正文。
    扫描每页，记录该页出现了哪些章节号。目录页会有多个，正文章节首页只有 1 个。"""
    per_page = []  # [(page_i, {ch_num: (size, text)})]
    for i in range(doc.page_count):
        found = {}
        for size, txt, _ in extract_spans(doc[i]):
            if size < min_size: continue
            m = CHAPTER_RE.search(txt)
            if not m: continue
            ch = zh_to_int(m.group(1))
            if ch == 0: continue
            if ch not in found or size > found[ch][0]:
                found[ch] = (size, txt)
        if found:
            per_page.append((i, found))

    chapters = {}  # ch -> (page, size, title)
    for i, found in per_page:
        # 单章节页=大概率正文章节起始
        if len(found) == 1:
            ch, (sz, txt) = next(iter(found.items()))
            if ch not in chapters:
                chapters[ch] = (i, sz, txt)
    # 补缺：某些章节可能从来没有单章节页（稀有），取多章节页里最大字号作为候选
    seen = set(chapters.keys())
    for i, found in per_page:
        for ch, (sz, txt) in found.items():
            if ch in seen: continue
            if ch not in chapters or sz > chapters[ch][1]:
                chapters[ch] = (i, sz, txt)
    out = []
    for ch in sorted(chapters.keys()):
        pg, sz, title = chapters[ch]
        out.append((pg, ch, title))
    return out


def find_sections_within(doc, start_page, end_page, min_section_size=26.0):
    """在某章范围内找小节标题（1.1 / 1.2）"""
    out = []
    for i in range(start_page, end_page):
        for size, txt, _ in extract_spans(doc[i]):
            if size < min_section_size: continue
            m = SECTION_RE.match(txt)
            if not m: continue
            code = normalize_section_code(m.group(1))
            parts = code.split(".")
            if len(parts) < 2: continue
            # 文字部分 = 整行去掉 code
            title = txt[m.end():].strip()[:60]
            out.append({"page": i+1, "code": code, "title": title, "size": size})
    return out


def page_text(page) -> str:
    return page.get_text("text")


def detect_scan_only(doc, sample=20):
    """采样 N 页，算平均每页字符密度。<80 认为是扫描件（无文字层）。"""
    step = max(1, doc.page_count // sample)
    total = 0
    n = 0
    for i in range(0, doc.page_count, step):
        t = doc[i].get_text("text") or ""
        total += len(t.strip())
        n += 1
    avg = total / max(1, n)
    return avg < 80, avg


def extract(stage, subject, edition, grade, volume):
    pdf = RAW_DIR / stage / subject / edition / grade / f"{volume}.pdf"
    if not pdf.exists():
        print(f"PDF 不存在: {pdf}", file=sys.stderr)
        return False
    out = OUT_DIR / stage / subject / edition / grade / volume
    out.mkdir(parents=True, exist_ok=True)
    print(f"打开 {pdf.relative_to(ROOT)}")
    doc = fitz.open(str(pdf))
    print(f"  总页数 {doc.page_count}")

    # 扫描 PDF 短路
    is_scan, avg_chars = detect_scan_only(doc)
    if is_scan:
        print(f"  跳过：扫描件（平均每页 {avg_chars:.0f} 字，需 OCR）")
        # 清掉旧的错误产物
        for old in out.glob("ch*.json"):
            old.unlink()
        stub = {
            "stage": stage, "subject": subject, "edition": edition,
            "grade": grade, "volume": volume,
            "pdf": str(pdf.relative_to(ROOT)).replace("\\", "/"),
            "page_count": doc.page_count,
            "status": "scan_only",
            "avg_chars_per_page": round(avg_chars, 1),
            "reason": "需 OCR（PaddleOCR / 其他）处理才能抽取文字层",
            "extracted_at": "2026-04-22"
        }
        (out / "meta.json").write_text(json.dumps(stub, ensure_ascii=False, indent=2), encoding="utf-8")
        return False

    chapters = find_chapters(doc)
    if not chapters:
        print("  主字号启发未命中 (需 ≥60pt)，降级到松散字号+单章节页规则")
        chapters = find_chapters_relaxed(doc)
    if not chapters:
        print("  松散启发也失败，用 TOC 兜底")
        toc = doc.get_toc()
        if not toc:
            print("  TOC 也为空，放弃")
            return False
        for lv, title, pg in toc:
            if lv == 1:
                chapters.append((pg-1, len(chapters)+1, title))

    print(f"  找到章节 {len(chapters)}:")
    for pg, ch, title in chapters:
        safe = title[:40].encode("gbk", errors="replace").decode("gbk", errors="replace")
        print(f"    第{ch}章 p{pg+1}  {safe}")

    # 组装每章页范围
    ch_ranges = []
    for idx, (pg, ch, title) in enumerate(chapters):
        end_pg = chapters[idx+1][0] if idx+1 < len(chapters) else doc.page_count
        ch_ranges.append((pg, end_pg, ch, title))

    # meta
    meta = {
        "stage": stage, "subject": subject, "edition": edition,
        "grade": grade, "volume": volume,
        "pdf": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        "page_count": doc.page_count,
        "extracted_at": "2026-04-21",
        "extractor_version": "1.0",
        "chapters": [
            {"ch": ch, "title": title, "start_page": pg+1, "end_page": end_pg}
            for (pg, end_pg, ch, title) in ch_ranges
        ]
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # 每章正文
    for pg, end_pg, ch, title in ch_ranges:
        pages = []
        for i in range(pg, end_pg):
            pages.append({"page": i+1, "text": page_text(doc[i])})
        sections = find_sections_within(doc, pg, end_pg)
        # 去重保留每个 code 首次出现（章首会有 TOC 小节重复）
        seen = {}
        for s in sections:
            if s["code"] not in seen:
                seen[s["code"]] = s
        sections = sorted(seen.values(), key=lambda x: (x["page"], x["code"]))

        ch_data = {
            "ch": ch, "title": title,
            "start_page": pg+1, "end_page": end_pg,
            "sections": sections,
            "pages": pages,
            "text": "\n\n".join(p["text"] for p in pages).strip()
        }
        fpath = out / f"ch{ch}.json"
        fpath.write_text(json.dumps(ch_data, ensure_ascii=False, indent=2), encoding="utf-8")
        total_chars = sum(len(p["text"]) for p in pages)
        print(f"    ch{ch}.json 写入 {end_pg - pg} 页 / {total_chars} 字符 / {len(sections)} 小节")

    print(f"  完成 -> {out.relative_to(ROOT)}")
    return True


def iter_downloaded():
    for pdf in RAW_DIR.rglob("*.pdf"):
        parts = pdf.relative_to(RAW_DIR).parts
        if len(parts) != 5: continue
        stage, subject, edition, grade, vol_file = parts
        volume = vol_file[:-4]
        yield stage, subject, edition, grade, volume


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("args", nargs="*")
    ap.add_argument("--all-downloaded", action="store_true")
    a = ap.parse_args()
    if a.all_downloaded:
        count = 0; ok = 0
        for t in iter_downloaded():
            count += 1
            if extract(*t):
                ok += 1
        print(f"\n=== 批量完成 {ok}/{count} ===")
        return
    if len(a.args) != 5:
        print(__doc__); sys.exit(2)
    ok = extract(*a.args)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
