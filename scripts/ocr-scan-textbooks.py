# -*- coding: utf-8 -*-
"""
ocr-scan-textbooks.py
用 rapidocr-onnxruntime 把扫描件 PDF 转成文字层，并写成 ch*.json，schema 跟 extract-chapters.py 对齐。

用法：
    python scripts/ocr-scan-textbooks.py 初中 数学 人教版 七年级 下册
    python scripts/ocr-scan-textbooks.py --all-scans               # 扫 meta.json status=scan_only 的全跑
    python scripts/ocr-scan-textbooks.py 初中 数学 人教版 七年级 下册 --pages 1-5  # 只试前 5 页
"""
import argparse, json, re, sys, io, time
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "textbooks-raw"
OUT_DIR = ROOT / "data" / "extracted"

CHAPTER_RE = re.compile(r"第([一二三四五六七八九十]+)(?:章|单元)\s*[\u4e00-\u9fff]{0,30}")
SECTION_RE = re.compile(r"^\s*([1-9]\d?\.[1-9]\d?(?:\.[1-9]\d?)?)")
ZH_NUM = {"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10}

def zh_to_int(s):
    if s in ZH_NUM: return ZH_NUM[s]
    if s.startswith("十"): return 10 + ZH_NUM.get(s[1:], 0)
    if s.endswith("十"):  return ZH_NUM.get(s[:1], 0) * 10
    if "十" in s:
        a,b = s.split("十")
        return ZH_NUM.get(a,1)*10 + ZH_NUM.get(b,0)
    return 0


def sp(msg):
    try: print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("gbk", errors="replace").decode("gbk", errors="replace"), flush=True)


def render_page(page, zoom=1.6):
    """PDF 页 -> PNG bytes（rapidocr 吃 ndarray/path/bytes）"""
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")


def ocr_page(ocr, png_bytes):
    """返回 (full_text, [(text, score)])"""
    res, _ = ocr(png_bytes)
    if not res: return "", []
    lines = []
    for item in res:
        # rapidocr 返回 [box, text, score]
        if len(item) >= 2:
            lines.append((item[1], float(item[2]) if len(item) > 2 else 0.0))
    text = "\n".join(t for t,_ in lines)
    return text, lines


def find_chapters_from_text(pages, skip_first=8):
    """pages=[{page,text}]. 前 skip_first 页多半是封面+目录，跳过做章起点识别。
    规则：某页整页只提到 1 个章节号（且在页前 15 行）= 正文章起始。"""
    out = {}
    sorted_pages = sorted(pages, key=lambda p: p["page"])
    for p in sorted_pages:
        if p["page"] <= skip_first: continue
        lines = [l.strip() for l in p["text"].split("\n") if l.strip()]
        seen_ch = {}
        for i, ln in enumerate(lines):
            m = CHAPTER_RE.search(ln)
            if not m: continue
            ch = zh_to_int(m.group(1))
            if ch == 0: continue
            title_candidate = ln
            if i+1 < len(lines) and 2 <= len(lines[i+1]) <= 25 and re.match(r"^[\u4e00-\u9fff、，,]+$", lines[i+1]):
                title_candidate = ln + " " + lines[i+1]
            if ch not in seen_ch:
                seen_ch[ch] = (i, title_candidate)
        # 整页只有 1 个章节号 + 出现在前 15 行 = 正文首页
        if len(seen_ch) == 1:
            ch, (line_idx, title) = next(iter(seen_ch.items()))
            if line_idx <= 15 and ch not in out:
                out[ch] = (p["page"]-1, title)
    # 补缺：剩下章节按「首次出现且跳过 TOC 区」回填
    for p in sorted_pages:
        if p["page"] <= skip_first: continue
        for ln in p["text"].split("\n"):
            m = CHAPTER_RE.search(ln)
            if not m: continue
            ch = zh_to_int(m.group(1))
            if ch == 0 or ch in out: continue
            out[ch] = (p["page"]-1, ln.strip())
    return [(pg, ch, t) for ch, (pg, t) in sorted(out.items())]


def run(stage, subject, edition, grade, volume, page_range=None, max_pages=None):
    pdf = RAW_DIR / stage / subject / edition / grade / f"{volume}.pdf"
    if not pdf.exists():
        sp(f"PDF 不存在: {pdf}"); return False
    out = OUT_DIR / stage / subject / edition / grade / volume
    out.mkdir(parents=True, exist_ok=True)

    sp(f"打开 {pdf.relative_to(ROOT)}")
    doc = fitz.open(str(pdf))
    total = doc.page_count
    sp(f"  总页数 {total}")

    # 决定跑哪些页
    if page_range:
        a,b = page_range
        pages_idx = list(range(max(0,a-1), min(total, b)))
    elif max_pages:
        pages_idx = list(range(min(max_pages, total)))
    else:
        pages_idx = list(range(total))
    sp(f"  OCR 页数 {len(pages_idx)} (总 {total})")

    sp("  载入 RapidOCR 模型（首次会下 ~10MB）...")
    ocr = RapidOCR()
    sp("  模型就绪，开始 OCR")

    pages = []
    t0 = time.time()
    for k, i in enumerate(pages_idx):
        png = render_page(doc[i])
        text, _ = ocr_page(ocr, png)
        pages.append({"page": i+1, "text": text})
        if (k+1) % 10 == 0 or k == len(pages_idx)-1:
            dt = time.time() - t0
            eta = dt / (k+1) * (len(pages_idx)-k-1)
            sp(f"    [{k+1}/{len(pages_idx)}] p{i+1} -> {len(text)} 字 | {dt:.0f}s 已用 / ~{eta:.0f}s 剩")

    chapters = find_chapters_from_text(pages)
    sp(f"  识别章节 {len(chapters)}:")
    for pg, ch, title in chapters:
        safe = title[:40].encode("gbk", errors="replace").decode("gbk", errors="replace")
        sp(f"    第{ch}章 p{pg+1}  {safe}")

    # 如果 OCR 结果压根没章节，至少存 meta 回落 scan_only 状态
    if not chapters:
        sp("  ⚠ 没识别出章节，退回 scan_only_ocr_failed")
        stub = {
            "stage": stage, "subject": subject, "edition": edition,
            "grade": grade, "volume": volume,
            "pdf": str(pdf.relative_to(ROOT)).replace("\\","/"),
            "page_count": total,
            "status": "scan_only_ocr_failed",
            "pages_ocred": len(pages),
            "total_chars": sum(len(p["text"]) for p in pages),
            "extracted_at": "2026-04-22",
        }
        (out / "meta.json").write_text(json.dumps(stub, ensure_ascii=False, indent=2), encoding="utf-8")
        return False

    # 章节范围
    ch_ranges = []
    for idx, (pg, ch, title) in enumerate(chapters):
        end_pg = chapters[idx+1][0] if idx+1 < len(chapters) else (pages_idx[-1]+1 if pages_idx else total)
        ch_ranges.append((pg, end_pg, ch, title))

    meta = {
        "stage": stage, "subject": subject, "edition": edition,
        "grade": grade, "volume": volume,
        "pdf": str(pdf.relative_to(ROOT)).replace("\\","/"),
        "page_count": total,
        "extracted_at": "2026-04-22",
        "extractor_version": "ocr-1.0",
        "source": "rapidocr-onnxruntime",
        "pages_ocred": len(pages),
        "chapters": [
            {"ch": ch, "title": title, "start_page": pg+1, "end_page": end_pg}
            for (pg, end_pg, ch, title) in ch_ranges
        ]
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # 构 page_index 方便快查
    page_by_num = {p["page"]: p for p in pages}

    for pg, end_pg, ch, title in ch_ranges:
        chpages = []
        for i in range(pg, end_pg):
            p = page_by_num.get(i+1)
            if p: chpages.append(p)
        ch_data = {
            "ch": ch, "title": title,
            "start_page": pg+1, "end_page": end_pg,
            "sections": [],  # OCR 字号信息丢了，不做小节
            "pages": chpages,
            "text": "\n\n".join(p["text"] for p in chpages).strip(),
        }
        fpath = out / f"ch{ch}.json"
        fpath.write_text(json.dumps(ch_data, ensure_ascii=False, indent=2), encoding="utf-8")
        total_chars = sum(len(p["text"]) for p in chpages)
        sp(f"    ch{ch}.json 写入 {len(chpages)} 页 / {total_chars} 字符")

    sp(f"  完成 -> {out.relative_to(ROOT)}")
    return True


def iter_scans():
    for meta in OUT_DIR.rglob("meta.json"):
        try:
            d = json.loads(meta.read_text(encoding="utf-8"))
        except Exception: continue
        if d.get("status","").startswith("scan_only"):
            yield d["stage"], d["subject"], d["edition"], d["grade"], d["volume"]


def parse_range(s):
    a,b = s.split("-")
    return int(a), int(b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("args", nargs="*")
    ap.add_argument("--all-scans", action="store_true")
    ap.add_argument("--pages", type=str, help="仅 OCR 指定页范围，例如 1-5")
    ap.add_argument("--max-pages", type=int, help="只取前 N 页（快速试跑）")
    a = ap.parse_args()

    page_range = parse_range(a.pages) if a.pages else None

    if a.all_scans:
        tot=ok=0
        for t in iter_scans():
            tot += 1
            try:
                if run(*t, page_range=page_range, max_pages=a.max_pages):
                    ok += 1
            except Exception as e:
                sp(f"  ❌ {t} -> {e}")
        sp(f"\n=== OCR 批量 {ok}/{tot} ===")
        return
    if len(a.args) != 5:
        print(__doc__); sys.exit(2)
    ok = run(*a.args, page_range=page_range, max_pages=a.max_pages)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
