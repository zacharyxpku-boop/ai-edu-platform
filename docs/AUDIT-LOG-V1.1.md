# v1.1 后端到端排雷日志

阁主在「调研分析思考而后谋」指令下，逐文件审视 8 步 ship 后产物的真实工作状态。
不是「打 commit 数」，是「假设现在让真孩子录屏，每个环节会不会真在 production 跑通」。

---

## 排雷顺序与杀伤评级

| # | 缺陷 | 杀伤面 | 真根因 | 修复 commit |
|---|---|---|---|---|
| 1 | seed SQL 用中文 enum 字面量「初一」「中学」 | seed 整段 22P02 跑不动 | 0001 grade/stage 是 PG enum 类型，需要 `middle_1::grade_enum` | `a1d9826` |
| 2 | `attempts.student_id` FK 强约束 | 真孩子直接进 mastery-loop 第一题写库 23503 | students 表无对应行，前端不调 student-init bootstrap | `17a5d54` (doc) |
| 3 | `ingest-attempt` / `log-dialogue` 把 `'fb1'` 当 UUID 写库 | fallback 题路径整条死 | `question_id \|\| null` 真值短路保留非 UUID 串 | `e49444e` |
| 4 | `knowledge_points.code` 表里没行 | `fsrs-update` 永久 404 / FSRS 复习推送瘫痪 | 0005 加了 code 字段但从未 INSERT 任何 KP | `7936435` |
| 5 | `mastery-loop` `TOPIC_CODE` 是 const 不读 URL | URL 上 `?topic_code=` 全部被吞 | 写法 `const TOPIC_CODE = 'math.7.ch3.kp3'` 没接 URLSearchParams | `7936435` |
| 6 | 老文档/代码混用 `kp-7-eq-linear` 与 `math.7.ch3.kpN` | 命名不一致，链接对不上 | 早期 mock 自创格式 vs 后期 ontology JSON 标准 | `7936435` + `8b3c590` |
| 7 | `parent-radar` 默认 `STUDENT_ID = 'demo-student-001'` | student-memory 调用 22P02，指纹面板永空 | 字符串非 UUID，跟套件其他页不一致 | `ebd7455` |
| 8 | **`mastery-loop.html` `STUDENT_ID` 整个文件未声明** | **6 处写库全部 ReferenceError 静默吞，零数据进库** | 可能从未跑通，因为 try/catch 兜住了 | `2784969` |
| 9 | `parent-report` 还残留旧 `'demo-student-001'` | 周报页同样 22P02 | 跟 #7 同源未一并修 | `bddba95` |
| 10 | `parent-radar` href 用 `?topic=` + MOCK kp_id 是 `kp-7-xxx` | 点链接落到 mastery-loop 默认 KP；NCDM 真上线后无法对应 | URL 参数名错配 + MOCK 数据不用 ontology | `95bba17` |
| 11 | seed SQL 自校验数字脑补 | total/visual/anxious 注释跟实际跑出来差 2-3 | 写 SQL 时手数错，没真跑 GROUP BY | `756027e` |
| 12 | `tutor-chat` 系统档案里直接拼 `student.grade` | LLM 看到 `middle_1` 字面量，输出可能复述 schema 字符串 | enum 没翻译层 | `e3e9023` |
| 13 | `embed-dialogue` 没 GitHub Actions cron | seed 入库后 embedding 永远 NULL，向量搜索返回 0 → tutor 第一句没历史可引用 | 只有 extract-signals 一个 yml，且被注释掉 | `8f27ec7` (doc) |
| 14 | parent-radar 雷达图永远 MOCK，跟 student_states 真 mastery 不同步 | Demo Day 「孩子练完 → 妈妈手机更新」会翻车 | NCDM 不部署 V1，雷达图只读 NCDM proxy 不读真表 | `00bef42` (doc) |

---

## 杀伤集中点

按「会让录屏直接报废」的概率分：

- **#8 STUDENT_ID 未声明**：单这一条已经让所有 v1.1 的「数据壁垒」claim 失效——之前一行 attempts/dialogues 都没成功写过。
- **#1 + #4 + #5**：让 seed 和 mastery-loop 整套连不通。
- **#3**：fallback 题路径死，但 get-questions 真有题时不触发，PoC 期高概率显形。
- **#13**：让 tutor 头一句的「记得你」差异化 claim 哑火。

---

## 修后的真实现度

之前 SESSION-REVIEW-V2 写「96%」是工程师视角虚标。
按「假设现在让真孩子用 30 分钟，写库 + tutor 引用 + 指纹面板能不能全跑通」算：

- 修前真实可演示度：**约 35%**（mastery-loop UI 看着工作，但底层零数据）
- 修后真实可演示度：**约 88%**（前置三件 seed + KP + embed 跑完后端到端通畅；雷达图 V1 仍 MOCK 是 spec 不是 bug）

---

## 用户跑录屏前的 3 件硬动作

按 SCRIPT §0.0 / §0.0a：

1. Supabase SQL Editor 跑一遍 `scripts/seed-demo-dialogues.sql`
2. PowerShell / 任意 shell：`curl -X POST "https://yuandianzhixue.com/api/embed-dialogue?limit=50" -H "X-Admin-Token: $TOKEN"`
3. 给孩子的 URL 用 `?topic_code=math.7.ch3.kp3` 而不是旧文档的 `kp-7-eq-linear`

---

## 暴露的方法论问题

这一波排雷之所以能挖出 14 条，是因为换了视角——从「我又 ship 了什么」转成「假设真孩子点进来，从 URL 解析到第一次写库这条链子哪一环会断」。

之前 8 步 ship 都是「加新功能 → 跑 lint」，没人真按时序模拟一次端到端。SESSION-REVIEW-V2 自评的「96%」就是这种盲点的产物。

往后定一条工程纪律：**每加一个新文件 / 新端点之前，先把现有路径从 URL 进入到数据库写入跑一遍 mental simulation**。这次 14 条里至少 10 条用 mental walk 就能抓到。

---

**版本**：v1.0 · 2026-04-27 排雷批次结束
**触发**：用户「调研分析思考而后谋」指令后的逐文件 grep
**前置**：SESSION-REVIEW-V2.md（v1.1 风险评估）+ REAL-KID-TEST-SCRIPT.md（试用 SOP）
