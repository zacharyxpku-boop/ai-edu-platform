# -*- coding: utf-8 -*-
"""
扩充 textbook-index.json 加入小学(1-6年级) + 高中(必修/选择性必修) 人教版主流科目。
基于 ChinaTextbook 的已知目录结构模板生成，github_url 指向 raw master。
"""
import json
import os
from pathlib import Path

REPO_BASE = "https://github.com/TapXWorld/ChinaTextbook/blob/master"

# 小学 1-6 年级主要科目（人教版为主）
PRIMARY_SUBJECTS = {
    "语文": {"版本": "统编版", "provider": "人民教育出版社", "folder": "语文/统编版-人民教育出版社"},
    "数学": {"版本": "人教版", "provider": "人民教育出版社", "folder": "数学/人教版-人民教育出版社"},
    "英语": {"版本": "人教版(PEP)", "provider": "人民教育出版社", "folder": "英语/人教版PEP-人民教育出版社"},
    "道德与法治": {"版本": "统编版", "provider": "人民教育出版社", "folder": "道德与法治/统编版-人民教育出版社"},
    "科学": {"版本": "教科版", "provider": "教育科学出版社", "folder": "科学/教科版-教育科学出版社"},
    "美术": {"版本": "人教版", "provider": "人民教育出版社", "folder": "美术/人教版-人民教育出版社"},
    "音乐": {"版本": "人教版(简谱)", "provider": "人民教育出版社", "folder": "音乐/人教版（简谱）-人民教育出版社"},
}
PRIMARY_GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"]

# 英语一般 3 年级起
PRIMARY_ENGLISH_START = 2  # index 2 = 三年级

# 高中 必修 + 选择性必修（人教版）
HIGH_SUBJECTS = {
    "语文": {"版本": "统编版", "provider": "人民教育出版社", "folder": "语文/统编版-人民教育出版社",
             "books": ["必修上册", "必修下册", "选择性必修上册", "选择性必修中册", "选择性必修下册"]},
    "数学A": {"版本": "人教A版", "provider": "人民教育出版社", "folder": "数学/人教A版-人民教育出版社",
             "books": ["必修第一册", "必修第二册", "选择性必修第一册", "选择性必修第二册", "选择性必修第三册"]},
    "数学B": {"版本": "人教B版", "provider": "人民教育出版社", "folder": "数学/人教B版-人民教育出版社",
             "books": ["必修第一册", "必修第二册", "必修第三册", "必修第四册", "选择性必修第一册", "选择性必修第二册", "选择性必修第三册"]},
    "英语": {"版本": "人教版", "provider": "人民教育出版社", "folder": "英语/人教版-人民教育出版社",
             "books": ["必修第一册", "必修第二册", "必修第三册", "选择性必修第一册", "选择性必修第二册", "选择性必修第三册", "选择性必修第四册"]},
    "物理": {"版本": "人教版", "provider": "人民教育出版社", "folder": "物理/人教版-人民教育出版社",
             "books": ["必修第一册", "必修第二册", "必修第三册", "选择性必修第一册", "选择性必修第二册", "选择性必修第三册"]},
    "化学": {"版本": "人教版", "provider": "人民教育出版社", "folder": "化学/人教版-人民教育出版社",
             "books": ["必修第一册", "必修第二册", "选择性必修1", "选择性必修2", "选择性必修3"]},
    "生物": {"版本": "人教版", "provider": "人民教育出版社", "folder": "生物学/人教版-人民教育出版社",
             "books": ["必修1分子与细胞", "必修2遗传与进化", "选择性必修1稳态与调节", "选择性必修2生物与环境", "选择性必修3生物技术与工程"]},
    "思想政治": {"版本": "统编版", "provider": "人民教育出版社", "folder": "思想政治/统编版-人民教育出版社",
             "books": ["必修1中国特色社会主义", "必修2经济与社会", "必修3政治与法治", "必修4哲学与文化", "选择性必修1当代国际政治与经济", "选择性必修2法律与生活", "选择性必修3逻辑与思维"]},
    "历史": {"版本": "统编版", "provider": "人民教育出版社", "folder": "历史/统编版-人民教育出版社",
             "books": ["必修中外历史纲要上", "必修中外历史纲要下", "选择性必修1国家制度与社会治理", "选择性必修2经济与社会生活", "选择性必修3文化交流与传播"]},
    "地理": {"版本": "人教版", "provider": "人民教育出版社", "folder": "地理/人教版-人民教育出版社",
             "books": ["必修第一册", "必修第二册", "选择性必修1自然地理基础", "选择性必修2区域发展", "选择性必修3资源环境与国家安全"]},
}


def build_primary():
    """构建小学 1-6 年级"""
    result = {}
    for subj, meta in PRIMARY_SUBJECTS.items():
        grades = {}
        for i, grade in enumerate(PRIMARY_GRADES):
            # 英语 3 年级起
            if subj == "英语" and i < PRIMARY_ENGLISH_START:
                continue
            volumes = {}
            for vol in ["上册", "下册"]:
                # 英语 PEP 有独特命名
                if subj == "英语":
                    title = f"义务教育教科书·英语{grade}{vol}(三年级起点)"
                elif subj == "音乐":
                    title = f"义务教育教科书·音乐（简谱）{grade}{vol}"
                else:
                    title = f"义务教育教科书·{subj}{grade}{vol}"
                path = f"小学/{meta['folder']}/{grade}/{title}.pdf"
                volumes[vol] = {
                    "title": title,
                    "path": path,
                    "github_url": f"{REPO_BASE}/{path}"
                }
            grades[grade] = volumes
        result[subj] = {
            meta["版本"]: {
                "provider": meta["provider"],
                "grades": grades
            }
        }
    return result


def build_high():
    """构建高中 必修/选择性必修"""
    result = {}
    for subj, meta in HIGH_SUBJECTS.items():
        books = {}
        for book in meta["books"]:
            title = f"普通高中教科书·{subj.rstrip('AB')}{book}"
            path = f"高中/{meta['folder']}/{title}.pdf"
            books[book] = {
                "title": title,
                "path": path,
                "github_url": f"{REPO_BASE}/{path}"
            }
        # 数学A/B 共享显示名"数学"
        display_subj = "数学" if subj in ("数学A", "数学B") else subj
        if display_subj not in result:
            result[display_subj] = {}
        result[display_subj][meta["版本"]] = {
            "provider": meta["provider"],
            "books": books
        }
    return result


def main():
    root = Path(__file__).parent.parent
    src = root / "src" / "curriculum" / "textbook-index.json"
    data = json.loads(src.read_text(encoding="utf-8"))

    data["小学"] = build_primary()
    data["高中"] = build_high()

    src.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"OK: 扩充完成")
    print(f"  初中 科目: {len(data.get('初中', {}))}")
    print(f"  小学 科目: {len(data.get('小学', {}))}")
    print(f"  高中 科目: {len(data.get('高中', {}))}")


if __name__ == "__main__":
    main()
