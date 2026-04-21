# -*- coding: utf-8 -*-
"""
用 GitHub Git Tree API 一次性抓整个仓库树 (单次 API 调用，避开 rate limit)。
重建 小学 + 高中 段。
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

TREE_URL = "https://api.github.com/repos/TapXWorld/ChinaTextbook/git/trees/master?recursive=1"
REPO_BLOB = "https://github.com/TapXWorld/ChinaTextbook/blob/master/"

PRIMARY_SUBJECTS = ["语文", "数学", "英语", "道德与法治", "科学", "美术", "音乐"]
HIGH_SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物学", "思想政治", "历史", "地理"]


def fetch_tree():
    req = urllib.request.Request(TREE_URL, headers={"User-Agent": "ydzx"})
    data = json.loads(urllib.request.urlopen(req, timeout=60).read())
    if data.get("truncated"):
        print("WARNING: tree truncated, some entries missing", file=sys.stderr)
    return data["tree"]


def simplify_version_name(name, stage):
    s = re.sub(r"-.*$", "", name)
    s = re.sub(r"（主编[：:][^）]*）", "", s)
    s = re.sub(r"（[主编责任编辑]+[：:][^）]*）", "", s)
    return s.strip()


def parse_primary_filename(fname):
    # "义务教育教科书 · 数学一年级上册.pdf"
    m = re.search(r"(一|二|三|四|五|六)年级[·\s]*(上|下)册", fname)
    if m:
        return m.group(1) + "年级", m.group(2) + "册"
    return None, None


def build_from_tree(tree):
    primary = {}
    high = {}
    for item in tree:
        if item["type"] != "blob":
            continue
        path = item["path"]
        if not path.endswith(".pdf"):
            continue
        parts = path.split("/")
        if len(parts) < 4:
            continue
        stage = parts[0]
        subj = parts[1]
        ver = parts[2]
        fname = parts[-1]

        if stage == "小学" and subj in PRIMARY_SUBJECTS:
            grade, vol = parse_primary_filename(fname)
            if not grade:
                continue
            ver_short = simplify_version_name(ver, stage)
            provider = ver.split("-", 1)[1] if "-" in ver else ""
            d = primary.setdefault(subj, {}).setdefault(ver_short, {
                "provider": provider, "grades": {}
            })
            d["grades"].setdefault(grade, {})[vol] = {
                "title": fname.replace(".pdf", ""),
                "path": path,
                "github_url": REPO_BLOB + urllib.parse.quote(path, safe="/"),
            }

        elif stage == "高中" and subj in HIGH_SUBJECTS:
            ver_short = simplify_version_name(ver, stage)
            provider = ver.split("-", 1)[1] if "-" in ver else ""
            d = high.setdefault(subj, {}).setdefault(ver_short, {
                "provider": provider, "books": {}
            })
            clean = fname.replace(".pdf", "")
            # 键名用完整文件名简化
            key = re.sub(r"^普通高中教科书[·\s]*", "", clean)
            key = re.sub(r"^" + re.escape(subj.rstrip("学")), "", key).strip("·· ")
            if not key:
                key = clean
            # 去重
            if key not in d["books"]:
                d["books"][key] = {
                    "title": clean,
                    "path": path,
                    "github_url": REPO_BLOB + urllib.parse.quote(path, safe="/"),
                }
    return primary, high


def main():
    root = Path(__file__).parent.parent
    src = root / "src" / "curriculum" / "textbook-index.json"
    data = json.loads(src.read_text(encoding="utf-8"))

    print("抓整树...", flush=True)
    tree = fetch_tree()
    print(f"共 {len(tree)} 条")

    primary, high = build_from_tree(tree)
    data["小学"] = primary
    data["高中"] = high

    src.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def count_books(stage_dict):
        n = 0
        for subj, vers in stage_dict.items():
            for ver, meta in vers.items():
                if "grades" in meta:
                    for g in meta["grades"]:
                        n += len(meta["grades"][g])
                if "books" in meta:
                    n += len(meta["books"])
        return n

    print("DONE:")
    print(f"  初中: {len(data.get('初中', {}))} 科")
    print(f"  小学: {len(primary)} 科, {count_books(primary)} 册")
    print(f"  高中: {len(high)} 科, {count_books(high)} 册")


if __name__ == "__main__":
    main()
