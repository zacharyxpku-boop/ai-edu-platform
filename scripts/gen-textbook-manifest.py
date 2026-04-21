# -*- coding: utf-8 -*-
"""
gen-textbook-manifest.py
扫 data/extracted/ 下所有 meta.json，合成一份 manifest.json 给前端 tools/textbook-browser.html 用。

只包含 born-digital 成功抽章的书；scan_only 另列到一个 scan 字段，前端可提示「待 OCR」。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "data" / "extracted"
OUT = EXT / "manifest.json"


def main():
    books = []
    scans = []
    for m in sorted(EXT.rglob("meta.json")):
        d = json.loads(m.read_text(encoding="utf-8"))
        rel_dir = m.parent.relative_to(EXT).as_posix()
        entry = {
            "stage": d.get("stage"),
            "subject": d.get("subject"),
            "edition": d.get("edition"),
            "grade": d.get("grade"),
            "volume": d.get("volume"),
            "page_count": d.get("page_count"),
            "path": rel_dir,
        }
        if d.get("status") == "scan_only":
            entry["reason"] = d.get("reason", "需 OCR")
            scans.append(entry)
        else:
            entry["chapters"] = [
                {"ch": c["ch"], "title": c["title"], "start_page": c["start_page"], "end_page": c["end_page"]}
                for c in d.get("chapters", [])
            ]
            books.append(entry)
    manifest = {
        "generated_at": "2026-04-22",
        "source": "ChinaTextbook github.com/TapXWorld/ChinaTextbook",
        "book_count": len(books),
        "scan_count": len(scans),
        "total": len(books) + len(scans),
        "books": books,
        "scans": scans,
    }
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"manifest -> {OUT.relative_to(ROOT)}")
    print(f"  books={len(books)}  scans={len(scans)}  total={len(books)+len(scans)}")


if __name__ == "__main__":
    main()
