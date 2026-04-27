#!/usr/bin/env python3
# 原点智学 · diagnose 端点真实归因准确率评测
#
# 用法：
#   PROD_HOST=https://0dianxue.com python3 scripts/eval-diagnose.py
#
# 设计：
#   data/eval/math-corner-cases.json 30 道题，每道带 (problem, correct_answer, wrong_response, expected_l3)。
#   分别测：
#     1) 答对路径门控 — 提交 correct_answer，diagnose 应当 has_error=false（不调 LLM）
#     2) 答错路径归因 — 提交 wrong_response，diagnose 应当 has_error=true 且 l3_tag 命中 expected_l3 前缀
#
#   通过条件：
#     - 答对门控 100%（任何一次假阳性 = 端点设计崩溃）
#     - 答错归因 ≥ 50% l3 前缀命中（K12 错题分类是公认难题，50% 是基线，70% 是优秀）

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

PROD_HOST = os.environ.get("PROD_HOST", "https://0dianxue.com").rstrip("/")
TIMEOUT = int(os.environ.get("TIMEOUT", "30"))

DATA_PATH = Path(__file__).parent.parent / "data" / "eval" / "math-corner-cases.json"


def call_diagnose(problem: str, correct_answer: str, student_response: str) -> dict:
    body = {
        "subject": "math",
        "problem": problem,
        "correct_answer": correct_answer,
        "student_response": student_response,
    }
    req = urllib.request.Request(
        f"{PROD_HOST}/api/diagnose",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"_error": f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}"}
    except Exception as e:
        return {"_error": str(e)}


def l3_prefix_match(pred_tags, expected: str) -> bool:
    """pred_tags 可能是字符串、列表或 null。expected 是 'knowledge.algebra.equation.move_sign' 形式。
    命中条件：pred 与 expected 共享至少前 3 段（如 knowledge.algebra.equation 即可算半命中）。"""
    if not pred_tags:
        return False
    if isinstance(pred_tags, str):
        pred_tags = [pred_tags]
    if not isinstance(pred_tags, list):
        return False
    expected_parts = expected.split(".")
    for tag in pred_tags:
        if not isinstance(tag, str):
            continue
        tag_parts = tag.split(".")
        # 至少前 3 段相同算命中（容错措辞差异）
        common = 0
        for i in range(min(len(expected_parts), len(tag_parts))):
            if expected_parts[i] == tag_parts[i]:
                common += 1
            else:
                break
        if common >= 3:
            return True
    return False


def run():
    if not DATA_PATH.exists():
        print(f"ERROR: 题库不存在 {DATA_PATH}")
        sys.exit(2)

    bank = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    cases = bank["cases"]
    print(f"题库版本：{bank['version']} · {len(cases)} 题")
    print(f"PROD_HOST = {PROD_HOST}")
    print("=" * 80)

    gate_pass, gate_fail = 0, 0
    attr_pass, attr_partial, attr_fail = 0, 0, 0
    failures = []

    for idx, case in enumerate(cases, 1):
        cid = case["id"]
        print(f"\n[{idx}/{len(cases)}] {cid}: {case['problem'][:50]}{'...' if len(case['problem']) > 50 else ''}")

        # === 1. 答对门控 ===
        r1 = call_diagnose(case["problem"], case["correct_answer"], case["correct_answer"])
        if "_error" in r1:
            print(f"  ✗ 门控调用失败: {r1['_error']}")
            failures.append((cid, "endpoint_error", r1["_error"]))
            time.sleep(0.4)
            continue
        if r1.get("has_error") is False:
            gate_pass += 1
            print(f"  ✓ 答对门控：has_error=false")
        else:
            gate_fail += 1
            print(f"  ✗ 答对门控失败：has_error={r1.get('has_error')} verdict={r1.get('verdict')}")
            failures.append((cid, "gate_false_positive", str(r1.get("has_error"))))

        # === 2. 答错归因 ===
        time.sleep(0.4)
        r2 = call_diagnose(case["problem"], case["correct_answer"], case["wrong_response"])
        if "_error" in r2:
            print(f"  ✗ 归因调用失败: {r2['_error']}")
            failures.append((cid, "attr_endpoint_error", r2["_error"]))
            time.sleep(0.4)
            continue
        if r2.get("has_error") is False:
            attr_fail += 1
            print(f"  ✗ 归因失败：has_error=false（应当=true）")
            failures.append((cid, "attr_missed_error", "wrong_response 被判对"))
        else:
            l3 = r2.get("l3_tag")
            expected = case["expected_l3"]
            if l3_prefix_match(l3, expected):
                attr_pass += 1
                print(f"  ✓ 归因命中：l3={l3} ~ expected={expected}")
            else:
                # 部分命中：has_error=true 但 l3 不对
                attr_partial += 1
                print(f"  ◐ 归因半命中：检测到错误但 l3={l3} ≠ expected={expected}")
                failures.append((cid, "attr_l3_mismatch", f"got {l3} want {expected}"))

        time.sleep(0.4)  # 速率限制 + ratelimit 保护

    n = len(cases)
    print("\n" + "=" * 80)
    print("=== 答对门控（必须 100%，任何假阳性 = 设计崩溃）===")
    gate_rate = gate_pass / n * 100 if n else 0
    print(f"  {gate_pass}/{n} = {gate_rate:.1f}%")

    print("\n=== 答错归因（≥50% 基线 / ≥70% 优秀）===")
    attr_total = attr_pass + attr_partial + attr_fail
    attr_full_rate = attr_pass / attr_total * 100 if attr_total else 0
    attr_detect_rate = (attr_pass + attr_partial) / attr_total * 100 if attr_total else 0
    print(f"  l3 命中: {attr_pass}/{attr_total} = {attr_full_rate:.1f}%")
    print(f"  仅检测出错（l3 不对）: {attr_partial}/{attr_total}")
    print(f"  完全漏判: {attr_fail}/{attr_total}")
    print(f"  错误检测率（含 l3 不对的）: {attr_detect_rate:.1f}%")

    if failures:
        print(f"\n失败明细（{len(failures)} 条）：")
        from collections import Counter
        cat = Counter(f[1] for f in failures)
        for k, v in cat.most_common():
            print(f"  · {k}: {v}")

    overall_pass = gate_rate == 100 and attr_full_rate >= 50
    if overall_pass:
        print(f"\n✅ 通过（门控 100% / 归因 {attr_full_rate:.0f}% ≥ 50%）")
        sys.exit(0)
    else:
        print(f"\n❌ 不达标 → 修 mistake-taxonomy.json l3 描述 或 diagnose system prompt")
        sys.exit(1)


if __name__ == "__main__":
    run()
