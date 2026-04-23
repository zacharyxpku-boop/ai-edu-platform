# -*- coding: utf-8 -*-
"""
gen-questions-from-chapter.py
把 data/extracted/**/ch*.json 的正文喂 DeepSeek，按每章生成 3 道带答案+解析+考点的题。
增量写 src/curriculum/seed-questions-generated.json，已生成的章节跳过。

用法：
    python scripts/gen-questions-from-chapter.py                      # 全量，数理化优先
    python scripts/gen-questions-from-chapter.py --subject 数学       # 只数学
    python scripts/gen-questions-from-chapter.py --stage 初中         # 只初中
    python scripts/gen-questions-from-chapter.py --limit 20           # 先试 20 章
    python scripts/gen-questions-from-chapter.py --retry-failed       # 把上次失败的重跑
"""
import argparse
import io
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Windows 默认 GBK，章节名里带全角空格/U+2003 会炸，强制 UTF-8
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "extracted" / "manifest.json"
EXT_DIR = ROOT / "data" / "extracted"
OUT = ROOT / "src" / "curriculum" / "seed-questions-generated.json"
DEEPSEEK = "https://api.deepseek.com/v1/chat/completions"

# subject 中文 -> arcade 前端 key
SUBJ_KEY = {
    "数学": "math", "物理": "physics", "化学": "chemistry",
    "生物学": "biology", "语文": "chinese", "英语": "english",
    "历史": "history", "地理": "geography",
    "思想政治": "politics", "道德与法治": "moral",
}
# 优先顺序：arcade 现有 tab 优先
SUBJECT_PRIORITY = ["数学", "物理", "化学", "生物学", "语文", "历史", "地理", "思想政治", "道德与法治", "英语"]

PROMPT = """你是资深教研员，按教材章节生成高质量练习题。

【章节信息】
学段：{stage}
学科：{subject}
年级：{grade}
教材：{edition} · {volume}
章节：{ch_title}

【章节正文片段】
{body}

【任务】
只基于上面正文生成 3 道题，覆盖本章核心考点，难度分布：1 易 + 1 中 + 1 难。
数学/物理/化学：计算+概念+应用题型搭配。
语文/历史/地理/政治/生物：选择题/简答题/分析题搭配。
英语：阅读理解/语法填空/翻译搭配。

【输出 JSON schema】严格按这个结构返回，不要 markdown code fence，不要多余文字：
{{
  "questions": [
    {{
      "difficulty": "easy|medium|hard",
      "question_text": "题面，公式用 LaTeX \\\\( \\\\)，不要截断",
      "answer": "最终答案，短",
      "solution_steps": "分步解析，学生看得懂，150 字内",
      "knowledge_points": ["考点 1", "考点 2"]
    }},
    ...
  ]
}}
禁止输出除这个 JSON 以外的任何字符。"""


def load_env():
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())
    return os.environ.get("DEEPSEEK_API_KEY")


def call_deepseek(key: str, prompt: str, retries: int = 2) -> dict | None:
    body = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.6,
        "max_tokens": 2200,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        DEEPSEEK, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        data=json.dumps(body).encode("utf-8"),
    )
    last_err = None
    for i in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.loads(r.read().decode("utf-8"))
            txt = data["choices"][0]["message"]["content"]
            return json.loads(txt)
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, KeyError) as e:
            last_err = e
            if i < retries:
                time.sleep(2 * (i + 1))
    print(f"    ! DeepSeek 失败 {last_err}", file=sys.stderr)
    return None


def ch_id(stage, subject, edition, grade, volume, ch):
    from hashlib import md5
    s = f"{stage}|{subject}|{edition}|{grade}|{volume}|ch{ch}"
    return f"gen-{SUBJ_KEY.get(subject, 'x')}-{md5(s.encode()).hexdigest()[:8]}"


def load_existing():
    if not OUT.exists():
        return {"meta": {"generated_by": "deepseek-chat", "version": 1}, "questions": [], "done": {}}
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except Exception:
        return {"meta": {"generated_by": "deepseek-chat", "version": 1}, "questions": [], "done": {}}


def save(state):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", help="只跑某学科，如 数学")
    ap.add_argument("--stage", help="只跑某学段")
    ap.add_argument("--limit", type=int, default=0, help="最多处理多少章")
    ap.add_argument("--retry-failed", action="store_true")
    a = ap.parse_args()

    key = load_env()
    if not key:
        print("缺 DEEPSEEK_API_KEY，请写入 .env.local", file=sys.stderr)
        sys.exit(2)

    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    books = m.get("books", [])
    # 学科排序
    books.sort(key=lambda b: (
        SUBJECT_PRIORITY.index(b["subject"]) if b["subject"] in SUBJECT_PRIORITY else 99,
        b.get("stage", ""), b.get("grade", "")
    ))

    state = load_existing()
    done = state.setdefault("done", {})
    questions = state.setdefault("questions", [])

    tasks = []
    for b in books:
        if a.subject and b["subject"] != a.subject: continue
        if a.stage and b["stage"] != a.stage: continue
        for c in b.get("chapters", []):
            key_id = f"{b['path']}|ch{c['ch']}"
            if key_id in done and done[key_id] == "ok" and not a.retry_failed:
                continue
            if key_id in done and done[key_id] == "fail" and not a.retry_failed:
                continue
            tasks.append((b, c, key_id))

    if a.limit:
        tasks = tasks[: a.limit]
    total = len(tasks)
    print(f"待生成：{total} 章")

    ok = 0; fail = 0
    t0 = time.time()
    for i, (b, c, key_id) in enumerate(tasks, 1):
        ch_file = EXT_DIR / b["path"] / f"ch{c['ch']}.json"
        if not ch_file.exists():
            done[key_id] = "missing_ch_file"; fail += 1; continue
        try:
            chdata = json.loads(ch_file.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[{i}/{total}] ch 读失败 {ch_file} {e}"); fail += 1
            done[key_id] = "fail"; continue
        body = (chdata.get("text") or "")[:3500]
        if len(body) < 200:
            done[key_id] = "too_short"; continue
        prompt = PROMPT.format(
            stage=b["stage"], subject=b["subject"], grade=b["grade"],
            edition=b["edition"], volume=b["volume"], ch_title=c["title"], body=body,
        )
        print(f"[{i}/{total}] {b['stage']} {b['subject']} {b['grade']} {b['volume']} {c['title']}")
        res = call_deepseek(key, prompt)
        if not res or not isinstance(res.get("questions"), list):
            done[key_id] = "fail"; fail += 1
            save(state); continue
        added = 0
        for q in res["questions"]:
            if not isinstance(q, dict): continue
            subj_en = SUBJ_KEY.get(b["subject"], "x")
            qid = f"{ch_id(b['stage'], b['subject'], b['edition'], b['grade'], b['volume'], c['ch'])}-{added+1}"
            questions.append({
                "id": qid,
                "subject": subj_en,
                "stage": b["stage"],
                "grade": b["grade"],
                "chapter": c["title"],
                "edition": b["edition"],
                "volume": b["volume"],
                "difficulty": q.get("difficulty", "medium"),
                "question_text": q.get("question_text", ""),
                "answer": q.get("answer", ""),
                "solution_steps": q.get("solution_steps", ""),
                "knowledge_points": q.get("knowledge_points", []) or [],
                "textbook_ref": {"path": b["path"], "ch": c["ch"]},
                "source": "deepseek",
            })
            added += 1
        done[key_id] = "ok"; ok += 1
        # 增量保存，挂掉也不丢
        state["meta"]["total"] = len(questions)
        state["meta"]["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
        save(state)
        # 轻 throttle
        if i % 10 == 0:
            print(f"  阶段进度 {i}/{total} ok={ok} fail={fail} 耗时 {(time.time()-t0)/60:.1f}min 已积累 {len(questions)} 题")
        time.sleep(0.3)

    save(state)
    print(f"\n=== 完成 ok={ok}/{total} fail={fail} · 题库累计 {len(questions)} 条 ===")


if __name__ == "__main__":
    main()
