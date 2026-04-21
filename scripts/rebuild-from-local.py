# -*- coding: utf-8 -*-
"""
从本地 shallow clone 的文件清单 /tmp/ct-files.txt 重建 textbook-index.json
避开 GitHub API 限流。
"""
import io
import json
import re
import sys
import urllib.parse
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

FILES_TXT = str(Path(__file__).parent / "ct-files.txt")
REPO_BLOB = "https://github.com/TapXWorld/ChinaTextbook/blob/master/"

PRIMARY_SUBJECTS = ["语文", "数学", "英语", "道德与法治", "科学", "美术", "音乐"]
HIGH_SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物学", "思想政治", "历史", "地理"]


def simplify_version_name(name):
    s = re.sub(r"-.*$", "", name)
    s = re.sub(r"（主编[：:][^）]*）", "", s)
    return s.strip()


def parse_primary_filename(fname):
    m = re.search(r"(一|二|三|四|五|六)年级[·\s]*(上|下)册", fname)
    if m:
        return m.group(1) + "年级", m.group(2) + "册"
    return None, None


def main():
    root = Path(r"C:\Users\86136\Desktop\claude\ai-edu-platform")
    src = root / "src" / "curriculum" / "textbook-index.json"
    data = json.loads(src.read_text(encoding="utf-8"))

    with open(FILES_TXT, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip()]

    primary = {}
    high = {}
    skipped_ext = 0
    for path in lines:
        if not path.endswith(".pdf"):
            # 跳过 .pdf.1 .pdf.2 这种分卷拼接文件
            skipped_ext += 1
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
            ver_short = simplify_version_name(ver)
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
            ver_short = simplify_version_name(ver)
            provider = ver.split("-", 1)[1] if "-" in ver else ""
            d = high.setdefault(subj, {}).setdefault(ver_short, {
                "provider": provider, "books": {}
            })
            clean = fname.replace(".pdf", "")
            # 键 = 去掉 "普通高中教科书·{subj无学}" 前缀
            key = re.sub(r"^普通高中教科书[·\s]*", "", clean)
            key = re.sub(r"^" + re.escape(subj.rstrip("学")), "", key).strip("·· ")
            if not key:
                key = clean
            if key not in d["books"]:
                d["books"][key] = {
                    "title": clean,
                    "path": path,
                    "github_url": REPO_BLOB + urllib.parse.quote(path, safe="/"),
                }

    data["小学"] = primary
    data["高中"] = high
    src.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def count(st):
        n = 0
        for _, vers in st.items():
            for _, meta in vers.items():
                if "grades" in meta:
                    for g in meta["grades"]:
                        n += len(meta["grades"][g])
                if "books" in meta:
                    n += len(meta["books"])
        return n

    print(f"跳过 .pdf.N 分卷: {skipped_ext}")
    print(f"小学: {len(primary)} 科 / {count(primary)} 册")
    print(f"高中: {len(high)} 科 / {count(high)} 册")
    for s, vers in primary.items():
        print(f"  小学 {s}: {len(vers)} 版本")
    for s, vers in high.items():
        print(f"  高中 {s}: {len(vers)} 版本")


if __name__ == "__main__":
    main()
