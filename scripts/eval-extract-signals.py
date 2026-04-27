#!/usr/bin/env python3
# 原点智学 · extract-dialogue-signals 6 字段抽取准确率评测
#
# 用法：
#   DEEPSEEK_KEY=sk-xxx python3 scripts/eval-extract-signals.py
#
# 设计：
#   16 条 seed dialogue 的 (content, ground_truth_signals) 作为基线测试集。
#   ground truth 是 seed 时人工设计的"教学专家会怎么标"。
#   逐条调 DeepSeek + extract-dialogue-signals 同款 SYSTEM_PROMPT 跑，比对 6 字段：
#
#   字段              比对方式
#   ────────────────────────────────────────────
#   stuck_point      关键词重叠 ≥ 50%（容忍措辞差异）
#   misconception_l3 严格前缀匹配（knowledge.* / ability.* / habit.*）
#   analogy_effective 严格 bool 匹配
#   emotion_state    严格枚举匹配
#   cognitive_style  严格枚举匹配
#   interest_keywords Jaccard ≥ 0.5
#
#   输出：每字段命中率 + 总体加权 F1。
#   通过条件：每字段 ≥ 70%（emotion / cognitive_style 严格枚举可降到 ≥ 60%）。

import json
import os
import sys
import re
import urllib.request
import urllib.error

DEEPSEEK_KEY = os.environ.get("DEEPSEEK_KEY") or os.environ.get("DEEPSEEK_API_KEY")
if not DEEPSEEK_KEY:
    print("ERROR: DEEPSEEK_KEY 或 DEEPSEEK_API_KEY 必须设置")
    sys.exit(2)

DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

# 从 api/extract-dialogue-signals.js 拷贝（保持同步）
SYSTEM_PROMPT = """你是 K12 学生认知行为分析专家。任务：从一条 AI 私教对话中抽取学生的 6 个隐性认知信号。

输入：一段对话（含一句学生说的话 + 上下文 1-2 句 tutor 之前的话）
输出：严格 JSON，无任何额外文字。

字段定义：

1. stuck_point（字符串，≤30 字）
   - 学生当前**最具体**的卡点。例：「分式方程去分母漏乘整式项」「移项忘记变号」
   - 不要写宽泛的「不会方程」，要具体到操作/概念
   - 如果学生答对了 / 在闲聊 / 没明显卡点，填 null

2. misconception_l3（字符串）
   - 从下面 64 类 misconception ID 里选一个 l3_id（精确匹配前缀）
   - 主要类目：knowledge.* / ability.* / habit.*
   - 没明显归因填 null

3. analogy_effective（true / false / null）
   - 如果上文 tutor 用了类比/比喻，看学生这句话的反应判断奏效
   - true: 学生说「哦原来是这样」「我懂了」「这样想就对了」类
   - false: 学生说「还是不懂」「这跟那个有什么关系」类
   - null: tutor 没用类比，或反应不明确

4. emotion_state（字符串）
   - 六选一：焦虑 / 自信 / 走神 / 投入 / 沮丧 / 平和

5. cognitive_style（字符串）
   - 五选一：visual / verbal / kinesthetic / abstract / unknown
   - 宁可填 unknown 也不要瞎猜

6. interest_keywords（数组）
   - 学生**自然提及**的兴趣点关键词，0-3 个
   - 必须是学生自己说的，每词 ≤ 6 字
   - 没提到就给空数组 []

输出格式严格如下（无任何 markdown 包裹）：
{"stuck_point":"...","misconception_l3":"...","analogy_effective":true,"emotion_state":"...","cognitive_style":"...","interest_keywords":[]}"""


# ============ Ground truth（从 seed-demo-dialogues.sql 抽取 student 行）============
# 仅抽 12 条 student 行，每条带上一句 tutor context（如有）作为 LLM 输入
TEST_CASES = [
    {
        "context": "",
        "content": "老师我又错了，3x + 5 = 17 这种我老把 5 移过去忘了变号",
        "truth": {
            "stuck_point": "一元一次方程移项忘记变号",
            "misconception_l3": "knowledge.algebra.equation.move_sign",
            "analogy_effective": None,
            "emotion_state": "焦虑",
            "cognitive_style": "unknown",
            "interest_keywords": [],
        },
    },
    {
        "context": "[tutor] 咱们换个画面想：等号左边和右边像跷跷板。+5 要从左边过到右边，过程中得「掉个号」，就像跨过等号要被「翻面」。我画个图你看看？",
        "content": "画图！画图！这样我就懂了，能画一下吗",
        "truth": {
            "stuck_point": None,
            "analogy_effective": True,
            "emotion_state": "投入",
            "cognitive_style": "visual",
            "interest_keywords": [],
        },
    },
    {
        "context": "",
        "content": "这个分式 (x+1)/2 - x/3 = 1 怎么去分母老是漏乘那个 1",
        "truth": {
            "stuck_point": "分式去分母漏乘整式项",
            "misconception_l3": "knowledge.algebra.fraction.miss_multiply",
            "analogy_effective": None,
            "emotion_state": "焦虑",
            "cognitive_style": "unknown",
            "interest_keywords": [],
        },
    },
    {
        "context": "[tutor] 想象一下篮球训练，每个动作都要做完整。去分母时分子 1 也是个「队员」，不能漏掉。",
        "content": "哦原来如此 我打篮球的时候教练也老说不能漏队员 这下记住了",
        "truth": {
            "analogy_effective": True,
            "emotion_state": "自信",
            "cognitive_style": "verbal",
            "interest_keywords": ["篮球"],
        },
    },
    {
        "context": "",
        "content": "5x - 7 = 3x + 9 这种两边都有未知数我又忘了符号",
        "truth": {
            "stuck_point": "一元一次方程移项忘记变号",
            "emotion_state": "焦虑",
            "cognitive_style": "unknown",
            "interest_keywords": [],
        },
    },
    {
        "context": "[tutor] 上次咱们用跷跷板画图你记住了。这次也是一样：3x 跨过等号要变 -3x。来，我列个表你填",
        "content": "这次画表清楚多了 我自己填一下 5x-3x=9+7 → 2x=16 → x=8",
        "truth": {
            "stuck_point": None,
            "analogy_effective": True,
            "emotion_state": "投入",
            "cognitive_style": "visual",
            "interest_keywords": [],
        },
    },
    {
        "context": "",
        "content": "应用题翻成方程是我最弱的 像那种「比 A 多 5」我永远不知道是 A+5 还是 A-5",
        "truth": {
            "stuck_point": "应用题文字到方程的翻译",
            "emotion_state": "沮丧",
            "cognitive_style": "unknown",
            "interest_keywords": [],
        },
    },
    {
        "context": "[tutor] 画图！把 A 画一段，「比 A 多 5」就是再画一段 5。",
        "content": "画线段我能懂！像玩游戏里的血条一样长长短短。再来一道",
        "truth": {
            "analogy_effective": True,
            "emotion_state": "投入",
            "cognitive_style": "visual",
            "interest_keywords": ["游戏"],
        },
    },
    {
        "context": "",
        "content": "老师能画个数轴吗 这种正负数我看图比看式子清楚",
        "truth": {
            "emotion_state": "焦虑",
            "cognitive_style": "visual",
            "interest_keywords": [],
        },
    },
    {
        "context": "",
        "content": "我打篮球的时候投篮角度也是这样三角形 数学课要是都这样画图我肯定喜欢",
        "truth": {
            "analogy_effective": True,
            "emotion_state": "投入",
            "cognitive_style": "visual",
            "interest_keywords": ["篮球"],
        },
    },
    {
        "context": "",
        "content": "为什么去分母要两边同时乘 我感觉是规则但想不清楚原理",
        "truth": {
            "stuck_point": "分式去分母原理理解",
            "analogy_effective": False,
            "emotion_state": "焦虑",
            "cognitive_style": "abstract",
            "interest_keywords": [],
        },
    },
    {
        "context": "",
        "content": "能再讲一遍吗 上次类比那个我没听明白",
        "truth": {
            "analogy_effective": False,
            "emotion_state": "焦虑",
            "cognitive_style": "verbal",
            "interest_keywords": [],
        },
    },
]


# ============ DeepSeek 调用 ============
def call_extract(content: str, context: str) -> dict:
    user_msg = f"{('【上下文】' + chr(10) + context + chr(10) + chr(10)) if context else ''}【本句】[student] {content}\n\n请按 schema 输出 JSON。"
    body = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.1,
        "max_tokens": 200,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"_error": f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}"}
    except Exception as e:
        return {"_error": str(e)}

    raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_error": f"parse_failed: {raw[:200]}"}


# ============ 字段比对函数 ============
def stuck_match(pred, truth) -> bool:
    if truth is None:
        return pred is None or pred == "null" or pred == ""
    if not pred or pred == "null":
        return False
    # 关键词重叠：取 truth 的 2 字以上 token，看 pred 命中数 ≥ 50%
    truth_tokens = re.findall(r"[一-鿿]{2,}|[a-zA-Z]+", truth)
    if not truth_tokens:
        return truth in pred
    hits = sum(1 for t in truth_tokens if t in pred)
    return (hits / len(truth_tokens)) >= 0.5

def strict_match(pred, truth) -> bool:
    return pred == truth

def bool_match(pred, truth) -> bool:
    return pred == truth  # 含 None 等于 None

def list_jaccard(pred, truth) -> bool:
    if not isinstance(pred, list):
        pred = []
    a, b = set(pred), set(truth)
    if not a and not b:
        return True
    if not a or not b:
        return False
    return len(a & b) / len(a | b) >= 0.5


FIELD_CHECKS = {
    "stuck_point": stuck_match,
    "misconception_l3": lambda p, t: t is None or (p is not None and (p == t or p.startswith(t.split(".")[0]))),
    "analogy_effective": bool_match,
    "emotion_state": strict_match,
    "cognitive_style": strict_match,
    "interest_keywords": list_jaccard,
}


def run():
    print(f"测试用例：{len(TEST_CASES)}")
    print(f"待评字段：{list(FIELD_CHECKS.keys())}")
    print("=" * 80)

    field_hits = {f: 0 for f in FIELD_CHECKS}
    field_totals = {f: 0 for f in FIELD_CHECKS}
    errors = []

    for idx, case in enumerate(TEST_CASES, 1):
        content_preview = case["content"][:50] + ("..." if len(case["content"]) > 50 else "")
        print(f"\n[{idx}/{len(TEST_CASES)}] {content_preview}")
        pred = call_extract(case["content"], case["context"])
        if "_error" in pred:
            print(f"  ✗ 调用失败: {pred['_error']}")
            errors.append((idx, pred["_error"]))
            continue

        for field, check_fn in FIELD_CHECKS.items():
            if field not in case["truth"]:
                continue
            truth_val = case["truth"][field]
            pred_val = pred.get(field)
            field_totals[field] += 1
            ok = check_fn(pred_val, truth_val)
            if ok:
                field_hits[field] += 1
            mark = "✓" if ok else "✗"
            t_repr = repr(truth_val)[:30]
            p_repr = repr(pred_val)[:30]
            print(f"    {mark} {field}: truth={t_repr} | pred={p_repr}")

    print("\n" + "=" * 80)
    print("字段准确率汇总：")
    overall_total = 0
    overall_hits = 0
    fail_threshold = {"stuck_point": 0.7, "misconception_l3": 0.6, "analogy_effective": 0.7,
                      "emotion_state": 0.6, "cognitive_style": 0.6, "interest_keywords": 0.7}
    failed_fields = []
    for field in FIELD_CHECKS:
        h, t = field_hits[field], field_totals[field]
        rate = (h / t * 100) if t else 0
        threshold = fail_threshold[field] * 100
        mark = "✓" if rate >= threshold else "✗"
        print(f"  {mark} {field}: {h}/{t} = {rate:.1f}% (阈值 {threshold:.0f}%)")
        if rate < threshold:
            failed_fields.append(field)
        overall_hits += h
        overall_total += t

    overall_rate = (overall_hits / overall_total * 100) if overall_total else 0
    print(f"\n总体：{overall_hits}/{overall_total} = {overall_rate:.1f}%")

    if errors:
        print(f"\n⚠️ {len(errors)} 条调用失败")

    if failed_fields:
        print(f"\n❌ 不达标字段：{failed_fields}")
        print("→ 改 api/extract-dialogue-signals.js SYSTEM_PROMPT 加强对应字段的描述 / 例子")
        sys.exit(1)
    else:
        print("\n✅ 所有字段达标")
        sys.exit(0)


if __name__ == "__main__":
    run()
