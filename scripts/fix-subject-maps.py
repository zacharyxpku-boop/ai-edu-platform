# -*- coding: utf-8 -*-
"""
统一修复 11 工具的 subjectNameMap / subjects 数组:
1. 小学 补全 7 科
2. 高中 政治 -> 思想政治
3. subjectNameMap 加 '思想政治': '思想政治'
"""
import io
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

root = Path(r"C:\Users\86136\Desktop\claude\ai-edu-platform")

FILES = [
    "tools/knowledge-explain.html",
    "tools/feynman-verify.html",
    "tools/knowledge-visual.html",
    "tools/study-plan.html",
    "tools/note-enhancer.html",
    "tools/scoring-breakdown.html",
    "tools/error-practice.html",
    "tools/exam-generator.html",
]

OLD_MAP = "var subjectNameMap = {'数学': '数学', '语文': '语文', '英语': '英语', '物理': '物理', '化学': '化学', '生物': '生物学', '历史': '历史', '地理': '地理', '政治': '道德与法治'};"
NEW_MAP = "var subjectNameMap = {'数学': '数学', '语文': '语文', '英语': '英语', '物理': '物理', '化学': '化学', '生物': '生物学', '历史': '历史', '地理': '地理', '政治': '道德与法治', '思想政治': '思想政治', '道德与法治': '道德与法治', '科学': '科学', '美术': '美术', '音乐': '音乐'};"

OLD_SUBJ = "var subjects = s === '初中' ? ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'] : s === '小学' ? ['语文', '数学', '英语'] : ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];"
NEW_SUBJ = "var subjects = s === '初中' ? ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'] : s === '小学' ? ['语文', '数学', '英语', '道德与法治', '科学', '美术', '音乐'] : ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '思想政治'];"

stats = []
for rel in FILES:
    p = root / rel
    txt = p.read_text(encoding="utf-8")
    n1 = txt.count(OLD_MAP)
    n2 = txt.count(OLD_SUBJ)
    new = txt.replace(OLD_MAP, NEW_MAP).replace(OLD_SUBJ, NEW_SUBJ)
    if new != txt:
        p.write_text(new, encoding="utf-8")
    stats.append((rel, n1, n2))

for rel, n1, n2 in stats:
    print(f"  {rel}: map={n1} subj={n2}")
