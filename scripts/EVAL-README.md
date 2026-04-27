# 评测套件使用手册

技术 100% push 沉淀的 4 件工具：从「相信 prompt 能跑」到「数据告诉我 prompt 跑得怎样」。

---

## TL;DR · 一行命令

```bash
PROD_HOST=https://yuandianzhixue.com \
STUDENT_ID=00000000-0000-0000-0000-000000000001 \
DEEPSEEK_KEY=sk-xxx \
    bash scripts/eval-all.sh
```

约 5-7 分钟出全套报告。任一项 FAIL 退出码 1。

---

## 4 件分别测什么

### A · `eval-tutor-prompt.py` — system prompt 跟随率

测**「DeepSeek 在 124 行规则下到底听不听话」**。

- 13 个测试用例覆盖：≤80 字、算术分步骤、粘贴检测、退场、4a/4b/4c、首句铁律、禁词
- 25 条断言（regex / 关键词 / 长度 / 枚举）
- 调 `/api/tutor-chat` SSE 累积响应，逐断言判 pass/fail
- 阈值：≥80% 总通过率合格

**典型失败 → 改写指引**：
- 「≤80字」失败率高 → 在 system prompt 第 9 节用更强语气：「**违反 ≤80 字 = 失败**」
- 「无套话开场」失败 → 在 §10 把禁词列得更具体
- 「分步骤」失败 → 给一个完整正例 + 反例对照

### B · `eval-extract-signals.py` — 6 字段抽取准确率

测**「跨会话记忆指纹这个差异化卖点是不是真在工作」**。

- 12 条 ground-truth dialogue（来自 seed 时人工设计的「教学专家会怎么标」）
- 直接调 DeepSeek + 同款 SYSTEM_PROMPT（不走端点，避免与端点其他逻辑耦合）
- 逐字段比对：

| 字段 | 比对方式 | 阈值 |
|---|---|---|
| stuck_point | 关键词重叠 ≥50% | 70% |
| misconception_l3 | 前缀至少 3 段 | 60% |
| analogy_effective | bool 严格 | 70% |
| emotion_state | 枚举严格 | 60% |
| cognitive_style | 枚举严格 | 60% |
| interest_keywords | Jaccard ≥0.5 | 70% |

**典型失败 → 改写指引**：
- `cognitive_style` 准确率低 → 加更多对比例子（学生说什么 = visual / verbal / abstract）
- `interest_keywords` 总误抽 → 收紧规则：「必须该条文本里字面出现」
- `misconception_l3` 命中率差 → 64 类 taxonomy.json 的描述更精确，加 example

需要 `DEEPSEEK_KEY`。直接调 DeepSeek，约 0.05 元 / 全跑。

### C · `eval-diagnose.py` — 错题归因准确率

测**「64 类 mistake-taxonomy 真能帮老师诊断错在哪」**。

- 30 道高考算术 corner-case（`data/eval/math-corner-cases.json`）
- 每道题双向测：
  1. **答对门控**：`student_response = correct_answer` → 端点必须 `has_error=false` → 阈值 100%（任何假阳性 = 设计崩溃）
  2. **答错归因**：`student_response = wrong_response` → 端点必须 `has_error=true` 且 `l3_tag` 与 `expected_l3` 共享前 3 段 → 阈值 50% 基线 / 70% 优秀

**典型失败 → 改写指引**：
- 门控失败 → 检查 `answerMatches()` 函数对小数 / 括号 / 等价表达式的处理
- l3 不命中 → 在 `mistake-taxonomy.json` 给那条 l3 加更典型的 example，让 LLM 容易匹配上

### D · `eval-all.sh` — 一键跑 + 时间戳归档

汇总 A+B+C，每件 stdout 同时落 `data/eval/runs/<TS>/{a,b,c}.log`，summary 走版本控制。

跑次曲线就在 `git log -- data/eval/runs/`。每改一版 prompt 跑一次，看哪一项变好哪一项变差。

跳过控制：`SKIP_A=1` / `SKIP_B=1` / `SKIP_C=1` 任意组合。

---

## 5.4 之前每天该做的

1. 早上 / 晚上各跑一次 `bash scripts/eval-all.sh`
2. summary.txt 入库（自动）
3. 如果 A 跌过 80% 或 B/C 任一字段跌出阈值，**先**改 prompt **再**ship 任何新东西
4. 周期性看 `git log data/eval/runs/` 的 PASS/FAIL 序列：
   - 持续 PASS 表示 prompt 工程稳定，可以放心做产品演示
   - 来回波动表示 prompt 改动太多，需要冻结 1-2 天看清趋势

---

## 这套不是为了通过率漂亮

通过率 80% 不等于产品好用。评测覆盖的是**「LLM 在结构化测试中遵循显式规则」**的能力。

PoC 真考验是：
- 真孩子 30 分钟用下来，A 测过的 13 case 都没在他嘴里出现
- 真孩子在课本里抠了一道题塞进对话框，B 抽出来的 cognitive_style 跟他班主任理解完全相反
- 真高考真题里有 30 道未在 C 题库里的怪题，DeepSeek 仍然算错

这套数据保**底层不崩**。**真验证还是录屏 + 真用户**。

---

## 加测试用例

A/B/C 三件的测试集都暴露在脚本顶部 / 同级 JSON 文件，扩展直接加：

- A：`scripts/eval-tutor-prompt.py` `CASES = [...]` 数组
- B：`scripts/eval-extract-signals.py` `TEST_CASES = [...]` 数组
- C：`data/eval/math-corner-cases.json` `cases` 数组

每加一条建议带 `comment` 字段说明这条测的是什么 corner case，未来有人 review 能快速理解意图。
