# -*- coding: utf-8 -*-
"""
enrich-chapter-titles.py
OCR 出来的物理/化学章节 title 多半是「第N章」「第N单元」没带知识点。
这里按人教版官方目录给每章补全 topic，manifest.json + ch{N}.json 同步改写。

跑完立即把 arcade 反链命中率从 47%→~75% 拉起。
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT  = ROOT / "data" / "extracted"
MANIFEST = EXT / "manifest.json"

# path → { ch: topic }（人教版官方章节目录）
TOPICS = {
    # ===== 初中物理 人教版 =====
    "初中/物理/人教版/八年级/上册": {
        1: "机械运动", 2: "声现象", 3: "物态变化", 4: "光现象",
        5: "透镜及其应用", 6: "质量与密度",
    },
    "初中/物理/人教版/八年级/下册": {
        7: "力", 8: "运动和力", 9: "压强", 10: "浮力",
        11: "功和机械能", 12: "简单机械",
    },
    "初中/物理/人教版/九年级/全一册": {
        13: "内能", 14: "内能的利用", 15: "电流和电路", 16: "电压 电阻",
        17: "欧姆定律", 18: "电功率", 19: "生活用电", 20: "电与磁",
        21: "信息的传递", 22: "能源与可持续发展",
    },
    # ===== 初中化学 人教版 =====
    "初中/化学/人教版/九年级/上册": {
        1: "走进化学世界", 2: "我们周围的空气", 3: "物质构成的奥秘",
        4: "自然界的水", 5: "化学方程式", 6: "碳和碳的氧化物",
        7: "燃料及其利用",
    },
    "初中/化学/人教版/九年级/下册": {
        8: "金属和金属材料", 9: "溶液", 10: "酸和碱",
        11: "盐 化肥", 12: "化学与生活",
    },
    # ===== 高中物理 人教版 =====
    "高中/物理/人教版/必修/第一册": {
        1: "运动的描述", 2: "匀变速直线运动的研究", 3: "相互作用—力",
        4: "运动和力的关系",
    },
    "高中/物理/人教版/必修/第二册": {
        5: "抛体运动", 6: "圆周运动", 7: "万有引力与宇宙航行",
        8: "机械能守恒定律",
    },
    "高中/物理/人教版/必修/第三册": {
        9: "静电场及其应用", 10: "静电场中的能量", 11: "电路及其应用",
        12: "电磁感应", 13: "电磁振荡与电磁波",
    },
    "高中/物理/人教版/选择性必修/第一册": {
        1: "动量守恒定律", 2: "机械振动", 3: "机械波", 4: "光",
    },
    "高中/物理/人教版/选择性必修/第二册": {
        1: "安培力与洛伦兹力", 2: "电磁感应及其应用", 3: "交变电流",
        4: "电磁振荡与电磁波", 5: "传感器",
    },
    "高中/物理/人教版/选择性必修/第三册": {
        1: "分子动理论", 2: "气体、固体和液体", 3: "热力学定律",
        4: "原子结构和波粒二象性", 5: "原子核",
    },
    # ===== 高中数学（人教A版）—— 已有 topic 但补一下 =====
    "高中/数学/人教A版/必修/第一册": {
        1: "集合与常用逻辑用语", 2: "一元二次函数、方程和不等式",
        3: "函数的概念与性质", 4: "指数函数与对数函数", 5: "三角函数",
    },
    "高中/数学/人教A版/必修/第二册": {
        6: "平面向量及其应用", 7: "复数", 8: "立体几何初步",
        9: "统计", 10: "概率",
    },
    "高中/数学/人教A版/选择性必修/第一册": {
        1: "空间向量与立体几何", 2: "直线和圆的方程", 3: "圆锥曲线的方程",
    },
    "高中/数学/人教A版/选择性必修/第二册": {
        4: "数列", 5: "一元函数的导数及其应用",
    },
    "高中/数学/人教A版/选择性必修/第三册": {
        6: "计数原理", 7: "随机变量及其分布", 8: "成对数据的统计分析",
    },
}


def enrich_title(old_title, ch, topic):
    """保留「第N章」/「第N单元」前缀，追加 topic。"""
    if not old_title:
        return f"第{ch}章 {topic}"
    # 已经有 topic 就不重写（避免二次追加）
    if topic in old_title:
        return old_title
    # 清掉尾部空白
    t = old_title.strip()
    # 识别「第N章」「第N单元」「第N章 xxx」形态
    m = re.match(r"^(第[零一二三四五六七八九十百\d]+[章单节元])", t)
    if m:
        prefix = m.group(1)
        return f"{prefix} {topic}"
    # 形态未知，直接追加
    return f"{t} {topic}"


def main():
    man = json.load(open(MANIFEST, encoding="utf-8"))
    changed_books = 0
    changed_ch_files = 0
    for b in man["books"]:
        topics_for_book = TOPICS.get(b["path"])
        if not topics_for_book:
            continue
        book_dirty = False
        for c in b["chapters"]:
            t = topics_for_book.get(c["ch"])
            if not t:
                continue
            old = c.get("title", "")
            new = enrich_title(old, c["ch"], t)
            if new != old:
                c["title"] = new
                book_dirty = True
                # 同步改写 ch{N}.json 的 title 字段
                ch_file = EXT / b["path"] / f"ch{c['ch']}.json"
                if ch_file.exists():
                    try:
                        d = json.load(open(ch_file, encoding="utf-8"))
                        if d.get("title") != new:
                            d["title"] = new
                            ch_file.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
                            changed_ch_files += 1
                    except Exception as e:
                        print(f"  ! {ch_file.name}: {e}")
        if book_dirty:
            changed_books += 1
            try:
                print(f"  updated {b['path']}")
            except UnicodeEncodeError:
                print(f"  updated <book {b['stage']}/{b['subject']}>")
    MANIFEST.write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n=== enriched {changed_books} books, {changed_ch_files} ch*.json files ===")


if __name__ == "__main__":
    main()
