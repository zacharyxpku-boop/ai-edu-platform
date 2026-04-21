# -*- coding: utf-8 -*-
"""
fetch-textbook.py
把 ChinaTextbook 仓库里的单本 PDF 拉到本地 data/textbooks-raw 下。

用法：
    python scripts/fetch-textbook.py 初中 数学 人教版 七年级 上册
    python scripts/fetch-textbook.py --list-editions 初中 数学
    python scripts/fetch-textbook.py --all 初中 数学 人教版       # 批拉某版本所有年级册

下载走 raw.githubusercontent.com，自动处理中文路径 URL 编码。
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "src" / "curriculum" / "textbook-index.json"
OUT_DIR = ROOT / "data" / "textbooks-raw"
RAW_BASE = "https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master/"


def load_index():
    return json.loads(INDEX.read_text(encoding="utf-8"))


def download(url: str, out: Path) -> int:
    """Stream download to file. Return bytes written."""
    out.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "ydzx-fetch/1.0"})
    n = 0
    with urllib.request.urlopen(req, timeout=120) as r, out.open("wb") as f:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
            n += len(chunk)
    return n


def entry_to_url(path: str) -> str:
    # index path is a raw Chinese string; encode each segment for URL.
    parts = [urllib.parse.quote(p, safe="") for p in path.split("/")]
    return RAW_BASE + "/".join(parts)


def out_path(stage: str, subject: str, edition: str, grade: str, volume: str) -> Path:
    return OUT_DIR / stage / subject / edition / grade / f"{volume}.pdf"


def fetch_one(idx, stage, subject, edition, grade, volume, force=False):
    try:
        entry = idx[stage][subject][edition]["grades"][grade][volume]
    except KeyError as e:
        print(f"索引缺 {stage}/{subject}/{edition}/{grade}/{volume}: {e}", file=sys.stderr)
        return False
    url = entry_to_url(entry["path"])
    dst = out_path(stage, subject, edition, grade, volume)
    if dst.exists() and not force:
        print(f"已存在 跳过 {dst.relative_to(ROOT)} ({dst.stat().st_size/1024:.0f} KB)")
        return True
    print(f"下载 {url}")
    print(f"    -> {dst.relative_to(ROOT)}")
    try:
        n = download(url, dst)
        print(f"    完成 {n/1024/1024:.1f} MB")
        return True
    except Exception as e:
        print(f"    失败 {e}", file=sys.stderr)
        if dst.exists() and dst.stat().st_size == 0:
            dst.unlink()
        return False


def list_editions(idx, stage, subject):
    try:
        editions = idx[stage][subject]
    except KeyError:
        print(f"无此学段/学科: {stage}/{subject}", file=sys.stderr)
        return
    for ed_name, ed in editions.items():
        provider = ed.get("provider", "?")
        grades = list(ed.get("grades", {}).keys())
        print(f"  {ed_name}（{provider}）年级: {', '.join(grades)}")


def fetch_all_edition(idx, stage, subject, edition):
    try:
        grades = idx[stage][subject][edition]["grades"]
    except KeyError as e:
        print(f"索引缺 {stage}/{subject}/{edition}: {e}", file=sys.stderr)
        return 0
    ok = 0
    total = 0
    for g, vols in grades.items():
        for v in vols.keys():
            total += 1
            if fetch_one(idx, stage, subject, edition, g, v):
                ok += 1
    print(f"\n=== {edition} {subject} 完成 {ok}/{total} ===")
    return ok


def main():
    ap = argparse.ArgumentParser(description="ChinaTextbook 单本/批量拉取")
    ap.add_argument("args", nargs="*", help="学段 学科 版本 [年级 册]")
    ap.add_argument("--list-editions", action="store_true")
    ap.add_argument("--all", action="store_true", help="拉指定版本的所有年级册")
    ap.add_argument("--force", action="store_true", help="强制重下已存在的文件")
    a = ap.parse_args()
    idx = load_index()

    if a.list_editions:
        if len(a.args) != 2:
            print("--list-editions 学段 学科", file=sys.stderr); sys.exit(2)
        list_editions(idx, a.args[0], a.args[1])
        return

    if a.all:
        if len(a.args) != 3:
            print("--all 学段 学科 版本", file=sys.stderr); sys.exit(2)
        fetch_all_edition(idx, a.args[0], a.args[1], a.args[2])
        return

    if len(a.args) != 5:
        print(__doc__); sys.exit(2)
    stage, subject, edition, grade, volume = a.args
    ok = fetch_one(idx, stage, subject, edition, grade, volume, force=a.force)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
