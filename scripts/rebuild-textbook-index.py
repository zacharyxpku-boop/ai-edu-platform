# -*- coding: utf-8 -*-
"""
通过 GitHub API 抓 ChinaTextbook 真实目录树，重建 textbook-index.json 的 小学/高中 段。
保留 初中 现有结构不动。
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_API = "https://api.github.com/repos/TapXWorld/ChinaTextbook/contents/"
REPO_BLOB = "https://github.com/TapXWorld/ChinaTextbook/blob/master/"

# 每学段只收录 主流出版社 + 常见科目，避免 1GB JSON
PRIMARY_SUBJECTS = ["语文", "数学", "英语", "道德与法治", "科学", "美术", "音乐"]
HIGH_SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物学", "思想政治", "历史", "地理"]


def gh_ls(path, retries=3):
    url = REPO_API + urllib.parse.quote(path)
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ydzx-script"})
            return json.loads(urllib.request.urlopen(req, timeout=20).read())
        except Exception as e:
            if i == retries - 1:
                print(f"  [错] {path}: {e}", file=sys.stderr)
                return []
            time.sleep(1 + i)


def parse_pdf_for_grade(filename, stage):
    """从文件名提取年级/册 (小学用) 或返回book名 (高中用)"""
    # 小学: "义务教育教科书 · 数学一年级上册.pdf"
    m = re.search(r"(一|二|三|四|五|六|七|八|九)年级[·\s]*(上|下)册", filename)
    if m:
        return m.group(1) + "年级", m.group(2) + "册"
    return None, None


def build_primary_subject(subj):
    """Returns {"版本1": {grades: {年级: {上册:..., 下册:...}}}}"""
    subj_versions = {}
    entries = gh_ls(f"小学/{subj}")
    time.sleep(0.3)
    for ver_dir in entries:
        if ver_dir["type"] != "dir":
            continue
        ver_name = ver_dir["name"]
        # 清洗版本名: 去 "-出版社" 只留版本标签
        ver_short = re.sub(r"-.*$", "", ver_name).strip()
        files = gh_ls(f"小学/{subj}/{ver_name}")
        time.sleep(0.3)
        grades = {}
        for f in files:
            if f["type"] != "file" or not f["name"].endswith(".pdf"):
                continue
            grade, vol = parse_pdf_for_grade(f["name"], "小学")
            if not grade:
                continue
            grades.setdefault(grade, {})[vol] = {
                "title": f["name"].replace(".pdf", ""),
                "path": f"小学/{subj}/{ver_name}/{f['name']}",
                "github_url": REPO_BLOB + urllib.parse.quote(f"小学/{subj}/{ver_name}/{f['name']}", safe="/"),
            }
        if grades:
            subj_versions[ver_short] = {
                "provider": ver_name.split("-", 1)[1] if "-" in ver_name else "",
                "grades": grades,
            }
    return subj_versions


def build_high_subject(subj):
    subj_versions = {}
    entries = gh_ls(f"高中/{subj}")
    time.sleep(0.3)
    for ver_dir in entries:
        if ver_dir["type"] != "dir":
            continue
        ver_name = ver_dir["name"]
        # 清洗: "人教版（A版）（主编：...）-人民教育出版社" -> "人教A版"
        ver_short = re.sub(r"-.*$", "", ver_name)
        ver_short = re.sub(r"（主编[^）]*）", "", ver_short)
        ver_short = re.sub(r"（(A版|B版)）", r"\1", ver_short)
        ver_short = ver_short.strip()
        files = gh_ls(f"高中/{subj}/{ver_name}")
        time.sleep(0.3)
        books = {}
        for f in files:
            if f["type"] != "file" or not f["name"].endswith(".pdf"):
                continue
            # book名 = 去掉 "普通高中教科书·{科}" 前缀 与 .pdf
            clean = f["name"].replace(".pdf", "")
            key = re.sub(r"^普通高中教科书[·\s]*" + subj.rstrip("学"), "", clean).strip("·· ")
            if not key:
                key = clean
            books[key] = {
                "title": clean,
                "path": f"高中/{subj}/{ver_name}/{f['name']}",
                "github_url": REPO_BLOB + urllib.parse.quote(f"高中/{subj}/{ver_name}/{f['name']}", safe="/"),
            }
        if books:
            subj_versions[ver_short] = {
                "provider": ver_name.split("-", 1)[1] if "-" in ver_name else "",
                "books": books,
            }
    return subj_versions


def main():
    root = Path(__file__).parent.parent
    src = root / "src" / "curriculum" / "textbook-index.json"
    data = json.loads(src.read_text(encoding="utf-8"))

    print("== 重建 小学 ==")
    data["小学"] = {}
    for subj in PRIMARY_SUBJECTS:
        print(f"  小学/{subj} ...", flush=True)
        v = build_primary_subject(subj)
        if v:
            data["小学"][subj] = v
        print(f"    版本 {len(v)}")

    print("== 重建 高中 ==")
    data["高中"] = {}
    for subj in HIGH_SUBJECTS:
        print(f"  高中/{subj} ...", flush=True)
        v = build_high_subject(subj)
        if v:
            data["高中"][subj] = v
        print(f"    版本 {len(v)}")

    src.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK: 重建完成")
    print(f"  小学 科目: {len(data['小学'])}")
    print(f"  高中 科目: {len(data['高中'])}")


if __name__ == "__main__":
    main()
