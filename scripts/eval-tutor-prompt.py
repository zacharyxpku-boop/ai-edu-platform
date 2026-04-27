#!/usr/bin/env python3
# 原点智学 · tutor-chat system prompt 指令跟随评测
#
# 用法：
#   PROD_HOST=https://yuandianzhixue.com STUDENT_ID=00000000-0000-0000-0000-000000000001 \
#       python3 scripts/eval-tutor-prompt.py
#
# 设计意图：
#   把 system prompt 里 124 行规则做成可量化 pass/fail 检查。
#   不是黑盒「跑一下看着像」，是 20 个具体场景，每个场景用断言函数判定。
#   失败率 > 10% 的规则反哺 prompt 改写。
#
# 通过条件：
#   - 总通过率 ≥ 80% 算 prompt 工程合格
#   - 「禁词出现」「ChatGPT 套话开场」「粘贴检测下直接讲题」属硬失败，单条命中 = 整体不合格

import json
import os
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Callable, Optional

PROD_HOST = os.environ.get("PROD_HOST", "https://yuandianzhixue.com").rstrip("/")
STUDENT_ID = os.environ.get("STUDENT_ID", "00000000-0000-0000-0000-000000000001")
TIMEOUT = int(os.environ.get("TIMEOUT", "30"))
# PROMPT_VERSION 通过 body.prompt_version 单次 override 走 server side
# 让 baseline 跑 v1 / v2 跑 v2 互不干扰，即使 server 默认设了别的也能强制切
PROMPT_VERSION = os.environ.get("PROMPT_VERSION", "v1")


# ============ SSE 消费 + 累积 ============
def call_tutor(message: str, history: list = None, is_pasted: bool = False) -> str:
    """调 /api/tutor-chat，累积 SSE 流返回 LLM 完整响应文本"""
    body = {
        "student_id": STUDENT_ID,
        "message": message,
        "history": history or [],
        "prompt_version": PROMPT_VERSION,
        "is_pasted": is_pasted,
    }
    req = urllib.request.Request(
        f"{PROD_HOST}/api/tutor-chat",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
    except urllib.error.HTTPError as e:
        return f"[HTTP {e.code}] {e.read().decode('utf-8', 'ignore')[:200]}"
    except Exception as e:
        return f"[NETWORK] {e}"

    accumulated = ""
    buf = b""
    for chunk in resp:
        buf += chunk
        while b"\n" in buf:
            line, _, buf = buf.partition(b"\n")
            line = line.decode("utf-8", "ignore").strip()
            if not line.startswith("data: "):
                continue
            data = line[6:].strip()
            if not data or data == "[DONE]":
                continue
            try:
                j = json.loads(data)
                delta = j.get("choices", [{}])[0].get("delta", {}).get("content")
                if delta:
                    accumulated += delta
            except json.JSONDecodeError:
                pass
    return accumulated.strip()


# ============ 断言函数库 ============
def assert_max_chars(n: int) -> Callable[[str], tuple]:
    def check(out: str):
        l = len(out)
        return (l <= n, f"长度 {l} ≤ {n}" if l <= n else f"长度 {l} 超过上限 {n}")
    return check

def assert_contains_any(*keywords: str) -> Callable[[str], tuple]:
    def check(out: str):
        hits = [k for k in keywords if k in out]
        return (len(hits) > 0, f"命中 {hits}" if hits else f"未命中 {list(keywords)}")
    return check

def assert_contains_none(*forbidden: str) -> Callable[[str], tuple]:
    def check(out: str):
        hits = [k for k in forbidden if k in out]
        return (len(hits) == 0, "无禁词" if not hits else f"出现禁词 {hits}")
    return check

def assert_no_chatgpt_opener() -> Callable[[str], tuple]:
    forbidden = ["你好我是 AI", "你好我是AI", "请问有什么可以", "让我来帮你",
                 "我是您的", "I am your", "Hello"]
    def check(out: str):
        first = out[:40]
        hits = [f for f in forbidden if f in first]
        return (len(hits) == 0, "开场无套话" if not hits else f"开场套话 {hits}")
    return check

def assert_arithmetic_stepwise() -> Callable[[str], tuple]:
    """方程解必须分步骤，标志：→ 或 = … = … 链式"""
    def check(out: str):
        has_arrow = "→" in out or "->" in out
        has_chain = out.count("=") >= 2
        ok = has_arrow or has_chain
        return (ok, "见到分步推导" if ok else "看不到 → 或多个 = 的链式")
    return check

def assert_paste_no_solving() -> Callable[[str], tuple]:
    """粘贴检测命中时不应该出现完整解题步骤"""
    def check(out: str):
        # 启发式：包含 = 数字 → 数字 → 数字 这种链式即视为讲题
        looks_solved = ("→" in out and "=" in out and any(c.isdigit() for c in out))
        return (not looks_solved, "未直接讲题" if not looks_solved else "疑似直接给出解题步骤")
    return check

def assert_redirect_back_to_topic() -> Callable[[str], tuple]:
    """闲聊偏题应当 1 句拉回"""
    redirect_words = ["这道题", "回到", "咱们的题", "继续", "先看", "不重要"]
    def check(out: str):
        hits = [w for w in redirect_words if w in out]
        return (len(hits) > 0, f"拉回信号 {hits}" if hits else "未明显拉回")
    return check

def assert_exit_no_pressure() -> Callable[[str], tuple]:
    """退场场景禁挽留语"""
    pressure = ["再坚持", "再做一题", "快了", "别放弃", "加油", "再试一下"]
    def check(out: str):
        hits = [p for p in pressure if p in out]
        return (len(hits) == 0, "无挽留语" if not hits else f"挽留语 {hits}")
    return check

def assert_correct_points_to_step() -> Callable[[str], tuple]:
    """v2 状态机：答对了必须点出对在哪一步，不能只说「对了」「真棒」"""
    cheap_praise = ["真棒", "不错继续", "好厉害", "你真聪明"]
    step_signals = ["这步", "这一步", "看出", "关键", "因为你", "你把", "你想到"]
    def check(out: str):
        cheap_hits = [c for c in cheap_praise if c in out]
        step_hits = [s for s in step_signals if s in out]
        if cheap_hits:
            return (False, f"廉价表扬 {cheap_hits}")
        return (len(step_hits) > 0, f"指出步骤 {step_hits}" if step_hits else "未点出对在哪一步")
    return check

def assert_skip_step_probe() -> Callable[[str], tuple]:
    """v2 状态机：答案对但跳关键步骤 → 必须追问那一步推导"""
    probe_signals = ["再说一遍", "怎么从", "为什么", "这步", "跳到", "我没跟上", "中间"]
    def check(out: str):
        hits = [p for p in probe_signals if p in out]
        return (len(hits) > 0, f"追问跳步 {hits}" if hits else "未追问跳步")
    return check


# ============ 测试用例 ============
@dataclass
class Case:
    name: str
    message: str
    history: list = field(default_factory=list)
    is_pasted: bool = False
    assertions: list = field(default_factory=list)
    note: str = ""

CASES = [
    # ─── ≤80 字铁律（5 case）────────────────────────────────
    Case("简短问答-加法", "5 加 3 等于几", assertions=[
        ("≤80字", assert_max_chars(80)),
        ("无禁词", assert_contains_none("赋能", "智能", "一站式", "AI 驱动", "高效")),
        ("无套话开场", assert_no_chatgpt_opener()),
    ]),
    Case("简短问答-移项", "解 3x+5=14", assertions=[
        ("≤120字_含步骤略放宽", assert_max_chars(120)),
        ("分步骤", assert_arithmetic_stepwise()),
    ]),
    Case("追问理解", "等式两边为什么可以同时除以 2", assertions=[
        ("≤80字", assert_max_chars(80)),
    ]),

    # ─── 算术铁律 ────────────────────────────────
    Case("分式计算", "(x+1)/2 - x/3 = 1，x 是几", assertions=[
        ("分步骤推导", assert_arithmetic_stepwise()),
        ("最终答案", assert_contains_any("x=", "x =", "等于", "答案")),
    ]),

    # ─── 粘贴检测（is_pasted=true）────────────────
    Case("粘贴长题", "如图所示，已知三角形 ABC 中，AB=5，BC=7，∠B=60°，求 AC 的长度并写出推导过程",
         is_pasted=True,
         assertions=[
             ("不直接讲题", assert_paste_no_solving()),
             ("追问思路或点破", assert_contains_any("自己想的", "复制", "第一反应", "你看到")),
         ],
         note="粘贴 ≥15 字命中反作弊路径，应当只追问思路"),

    # ─── 退场处理 ────────────────────────────────
    Case("孩子说累了", "我累了，明天再做吧",
         history=[{"role": "user", "content": "解 2x=10"},
                  {"role": "assistant", "content": "x 等于多少？"}],
         assertions=[
             ("无挽留语", assert_exit_no_pressure()),
             ("有钩子", assert_contains_any("明天", "下次", "今天", "至少")),
         ]),
    Case("孩子说不想做", "不想做了",
         assertions=[("无挽留语", assert_exit_no_pressure())]),

    # ─── v2 状态机分支：答对要点出对在哪一步 ────────
    Case("答对了-要点步骤", "x=2",
         history=[{"role": "user", "content": "解 2x=4"},
                  {"role": "assistant", "content": "好，自己算算看"}],
         assertions=[
             ("不止说对", assert_correct_points_to_step()),
             ("≤80字", assert_max_chars(80)),
             ("无套话", assert_contains_none("真棒", "不错", "你真聪明")),
         ],
         note="v2 §答题状态机：必须指出对在哪一步，禁廉价表扬"),

    # ─── v2 状态机分支：答案对但跳步骤 ──────────────
    Case("答案对跳步骤", "x=2",
         history=[{"role": "user", "content": "解 (x+1)/2 - x/3 = 1，x 是几"},
                  {"role": "assistant", "content": "试试先去分母"}],
         assertions=[
             ("追问跳步", assert_skip_step_probe()),
             ("≤120字", assert_max_chars(120)),
         ],
         note="v2 §答题状态机：高考阅卷给步骤分，结果对过程错下次同型还栽"),

    # ─── 4b 要直接答案 ────────────────────────────
    Case("学生要答案", "你直接告诉我答案吧，我不想想了",
         history=[{"role": "user", "content": "解 5x-7=3x+9"},
                  {"role": "assistant", "content": "试试把含 x 的项移到一边"}],
         assertions=[
             ("不让步给完整解", assert_contains_none("=", "答案是")),
             ("提到尝试或时限", assert_contains_any("试", "想想", "分钟", "提示")),
         ],
         note="4b 规则：1 分钟时限挑战，过了升档"),

    # ─── 4c 闲聊偏题 ─────────────────────────────
    Case("学生问 AI 身份", "你叫什么名字？你是机器人吗？",
         assertions=[
             ("有拉回", assert_redirect_back_to_topic()),
             ("≤80字", assert_max_chars(80)),
         ]),
    Case("学生闲聊抖音", "今天我看了一个抖音视频好搞笑，你想看吗",
         assertions=[
             ("有拉回", assert_redirect_back_to_topic()),
         ]),

    # ─── 第一句铁律 + ChatGPT 套话防御 ──────────────
    Case("首次开场", "今天我该练什么", assertions=[
        ("无套话开场", assert_no_chatgpt_opener()),
        ("≤120字_可能引用历史", assert_max_chars(120)),
    ]),
    Case("学生说不会", "我学不好数学",
         assertions=[
             ("不灌鸡汤", assert_contains_none("加油", "你能行", "相信自己")),
             ("≤100字", assert_max_chars(100)),
         ]),

    # ─── 禁词全文检查 ───────────────────────────
    Case("普通问句", "什么是一元一次方程",
         assertions=[
             ("无 AI 营销禁词", assert_contains_none("赋能", "智能", "一站式",
                                                     "AI 驱动", "高效", "请问有什么可以帮您")),
         ]),
]


# ============ 主执行 ============
def run():
    print(f"PROD_HOST = {PROD_HOST}")
    print(f"STUDENT_ID = {STUDENT_ID}")
    print(f"PROMPT_VERSION = {PROMPT_VERSION}（v1=147 行原版 / v2=阁主蒸馏 52 行版）")
    print(f"测试用例数：{len(CASES)}")
    print(f"每条断言数总计：{sum(len(c.assertions) for c in CASES)}")
    print("=" * 80)

    pass_n, fail_n = 0, 0
    failure_log = []

    for idx, case in enumerate(CASES, 1):
        print(f"\n[{idx}/{len(CASES)}] {case.name}")
        print(f"  → message: {case.message[:60]}{'...' if len(case.message) > 60 else ''}")
        if case.is_pasted:
            print("  → is_pasted=true（反作弊路径）")

        out = call_tutor(case.message, case.history, case.is_pasted)
        if out.startswith("[HTTP ") or out.startswith("[NETWORK]"):
            print(f"  ✗ {out}")
            fail_n += len(case.assertions)
            failure_log.append((case.name, "endpoint_error", out))
            continue

        print(f"  ← 输出 ({len(out)} 字): {out[:100]}{'...' if len(out) > 100 else ''}")

        for a_name, check_fn in case.assertions:
            ok, detail = check_fn(out)
            mark = "✓" if ok else "✗"
            print(f"    {mark} {a_name}: {detail}")
            if ok:
                pass_n += 1
            else:
                fail_n += 1
                failure_log.append((case.name, a_name, detail))

        time.sleep(0.5)  # 间隔避开速率限制

    total = pass_n + fail_n
    rate = (pass_n / total * 100) if total else 0
    print("\n" + "=" * 80)
    print(f"总结：{pass_n}/{total} 通过（{rate:.1f}%）")

    if failure_log:
        print("\n失败明细（按规则聚合，>10% 失败率的需要 prompt 改写）：")
        from collections import Counter
        fail_by_rule = Counter(f[1] for f in failure_log)
        for rule, n in fail_by_rule.most_common():
            print(f"  · {rule}: {n} 次失败")

    if rate >= 80:
        print("\n✅ ≥80% 通过率：prompt 工程合格")
        sys.exit(0)
    else:
        print(f"\n❌ {rate:.1f}% < 80%：需要按失败明细改 prompt")
        sys.exit(1)


if __name__ == "__main__":
    run()
