# -*- coding: utf-8 -*-
"""
fetch-textbook-highschool.py
拉高中人教版数学/物理/化学 PDF。高中目录结构跟初中不一样：
  高中/<subject>/<edition>/<volume>.pdf  （有时会 .pdf.1 .pdf.2 分片，要拼回去）

存到本地统一成 5 层跟初中对齐：
  data/textbooks-raw/高中/<subject>/<edition-short>/<track>/<volume>.pdf
  track 取「必修」/「选择性必修」

只拉人教版 A 版数学、人教版物理、人教版化学，每 subject 的必修册。
"""
import json, re, sys, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "textbooks-raw"
RAW_BASE = "https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master"
API_BASE = "https://api.github.com/repos/TapXWorld/ChinaTextbook/contents"

TARGETS = [
    {
        "subject": "数学",
        "remote_edition": "人教版（A版）（主编：章建跃&李增沪）-人民教育出版社",
        "edition_short": "人教A版",
    },
    {
        "subject": "物理",
        "remote_edition": "人教版-人民教育出版社",
        "edition_short": "人教版",
    },
    {
        "subject": "化学",
        "remote_edition": "人教版-人民教育出版社",
        "edition_short": "人教版",
    },
]


def list_remote(subject, edition):
    url = f"{API_BASE}/{urllib.parse.quote('高中/'+subject+'/'+edition)}"
    req = urllib.request.Request(url, headers={"User-Agent": "yuandian-fetch"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def parse_volume(fn):
    """普通高中教科书·数学（A版）必修 第二册.pdf -> ('必修', '第二册')"""
    m = re.search(r"(选择性必修|必修)\s*(第[一二三四五六]册)", fn)
    if not m:
        return None
    return m.group(1), m.group(2)


def download_bytes(url):
    # GitHub 给的 download_url 可能带裸空格和中文，逐段 quote
    from urllib.parse import urlsplit, urlunsplit, quote
    parts = urlsplit(url)
    safe_path = "/".join(quote(seg, safe="") for seg in parts.path.split("/"))
    url2 = urlunsplit((parts.scheme, parts.netloc, safe_path, parts.query, parts.fragment))
    req = urllib.request.Request(url2, headers={"User-Agent": "yuandian-fetch"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def sp(msg):
    """Windows gbk 安全打印，非 gbk 字符用 ? 替换。"""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("gbk", errors="replace").decode("gbk", errors="replace"))


def main():
    force = "--force" in sys.argv
    for t in TARGETS:
        sp(f"=== 高中 / {t['subject']} / {t['edition_short']} ===")
        try:
            items = list_remote(t["subject"], t["remote_edition"])
        except Exception as e:
            sp(f"  ❌ list err: {e}")
            continue
        # 按 (track, volume) 聚合分片
        groups = {}
        for it in items:
            if it["type"] != "file": continue
            fn = it["name"]
            pv = parse_volume(fn)
            if not pv: continue
            track, volume = pv
            # 分片排序 key：.pdf / .pdf.1 / .pdf.2 ...
            m = re.search(r"\.pdf(?:\.(\d+))?$", fn)
            if not m: continue
            idx = int(m.group(1) or "0")
            groups.setdefault((track, volume), []).append((idx, fn, it["download_url"]))
        for (track, volume), parts in sorted(groups.items()):
            parts.sort()
            out = RAW / "高中" / t["subject"] / t["edition_short"] / track / f"{volume}.pdf"
            if out.exists() and not force:
                sp(f"  ✓ 存在 {out.relative_to(ROOT)} ({out.stat().st_size//1024}K)")
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            sp(f"  ↓ {track}/{volume} ({len(parts)} 片) -> {out.relative_to(ROOT)}")
            buf = bytearray()
            for idx, fn, url in parts:
                try:
                    data = download_bytes(url)
                    buf.extend(data)
                    sp(f"      part{idx} {fn} -> {len(data)//1024}K")
                except Exception as e:
                    sp(f"      ❌ {fn}: {e}")
                    break
            if buf:
                out.write_bytes(bytes(buf))
                sp(f"    done {len(buf)//1024}K")


if __name__ == "__main__":
    main()
