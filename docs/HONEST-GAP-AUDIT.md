# 诚实差距审计 · 2026-04-27

阁主自查：把 AI-TUTOR-TOPDOWN-DESIGN v1.1「实现度 96%」这句话挤水分。

> 触发事件：用户截图 tutor.html 显示深底 UI + 右下角 emoji 机器人，跟我代码里写的「暖白底 + 橙色墨字头像」对不上。这说明我至少在 UI pivot 这件事上吹了水。本文核查每一项要素的真实状态。

---

## 校准方法

每项要素三道关：
1. **代码关**：grep / Read 拿到当前源码事实
2. **部署关**：WebFetch 抓 yuandianzhixue.com 看线上是否一致
3. **数据关**：API 是否真返回数据，还是 hardcode 占位

任何一关没过就降档。

---

## 校准总表

| 要素 | v1.1 自评 | 真实状态 | 证据 | 修复成本 |
|---|---|---|---|---|
| 1. 真私教记忆 | 92% | **70%** | API 写好但用户截图依旧"读取记忆中..."、最近卡点是 hardcode | 接 student_signal_profile RPC 到右栏，2h |
| 2. 教学法 4 流派灌进 prompt | 100% | **85%** | v1 prompt 灌了，但 v1.2 audit 暴露 6 段散落、衰减区。v2 已 draft 没切 | 跑 baseline 数据 + 切 v2，4h |
| 3. 动机心理 3 流派 | 100% | **85%** | 同上，灌了但混在长 prompt 里指令跟随未验证 | 同上 |
| 4. 好玩 3 机制 | 65% | **45%** | 即时反馈 ok；不确定性彩蛋 / 社交在场感都没做；晒图金句仅文本未带图 | 内测后再做，先不动 |
| 5. 个性化 4 维度 | 95% | **75%** | 6 字段抽取 ship 了，但聚合 RPC 没在 tutor 右栏可视化；线上演示账号信号库为空 | 接 RPC + 种子数据，3h |
| 6. Khanmigo 借鉴 | 95% | **60%** | 算术铁律 + 粘贴检测 ship；但**产品形态本身**直到这一轮才补上三栏布局，本来只是聊天框 | 这一轮 commit e5dd599 已补，待用户验证 |
| 7. 中国应试锚点 | 95% | **80%** | 课标 + 教材 + 中文术语 ship；但 PoC 只覆盖一元一次方程 1 章 7 KP，其他全锁 | 内测后扩 KP 池 |
| 8. 真壁垒数据 | 95% | **40%** | schema 在，端点活；**但库里 0 条真实学生对话**，全演示账号 | 5.5-6.1 内测 30 人才能开始累积 |
| 9. 妈妈日报 | 85% | **70%** | parent-radar UI 重做了；但日报内容是 mock，没接真信号 | 接 RPC，2h |

**真实加权总分：≈ 68%**（v1.1 自评 96% 高估 28 点）

---

## 三处最大水分（不挑出来下次还吹）

### 水分 1：「UI 已 Khanmigo 化」
- 自评：第 3 段视觉 ship。
- 真相：直到 commit e5dd599（这一轮）tutor.html 才有三栏布局 + 学科树 + 学习面板。之前只是把"聊天框"换成了"暖色聊天框"。
- 教训：以后 UI claim 必须 WebFetch 抓线上 + 视觉描述事实，不能只 grep CSS 变量。

### 水分 2：「跨会话记忆 92%」
- 自评：dialogues + pgvector + extract-signals 全活。
- 真相：API 端点全活属实，但 tutor 顶部"读取记忆中..." / "看你最近卡哪"占位在演示账号下永远不变。库里没真实数据，演示账号 student_id `00000000...` 没种子对话。
- 教训：「端点活」≠「记忆能力 ship」。需要 seed 演示档案让 demo 有真东西可显。

### 水分 3：「妈妈日报 85%」
- 自评：parent-radar / parent-report ship。
- 真相：UI ship 了，但 KP 数据 / 雷达数值 / 周报文字全 mock。家长打开看到"小米同学本周掌握 X、Y、Z"——X/Y/Z 是写死的字符串，跟实际学习行为零关联。
- 教训：UI ship ≠ 产品价值 ship。家长视角的「真壁垒」是个性化日报，mock 数据撑不起这个壁垒。

---

## 如果接下来只能做 3 件事（按 ROI 排）

### 1️⃣ Seed 演示账号档案（半天）
让 student_id `00000000-0000-0000-0000-000000000001` 拥有：
- 5 条历史 dialogues（一元一次方程移项 / 去分母对话）
- 3 个 weak KPs（移项忘变号 / 去分母漏乘 / 去括号符号）
- 1 个 cognitive_style: visual + 1 个 analogy_effective: 0.62
- 1 个 stuck point: 「等式两边同除时忘了-的影响」

这样 demo 一打开 tutor.html 就能看到「上次咱们在『移项忘变号』那卡过」而不是「读取记忆中...」。
**这一项不做，5.4 Demo Day 现场会现 mock 数据原形。**

### 2️⃣ 跑 PROMPT_VERSION=v1 baseline 拿数（你 1h）
v2 prompt draft 拍板了，但没数据就盲切是赌博。这步是切 v2 的唯一 gating。
代码命令：
```bash
PROMPT_VERSION=v1 bash scripts/eval-all.sh > baseline-v1.txt
PROMPT_VERSION=v2 bash scripts/eval-all.sh > baseline-v2.txt
diff baseline-v1.txt baseline-v2.txt
```

### 3️⃣ 接 student_signal_profile RPC 到 tutor 右栏（2h，我）
让"最近卡点 / BKT 进度 / 下次复习"显示真数据而不是 hardcode。
不接的话三栏布局也是个壳子，跟 mock 没区别。

---

**结论**：96% 是骗自己。真实 68%。差距全在「数据接通」和「演示账号种子」上，不在「再写一段 prompt」上。
**接下来 1 周不做新 UI，只做以上 3 件 + 真孩子录屏。**

---

**版本**：v1.0 · 2026-04-27 自审
**触发**：用户截图深底 tutor + 怒喷"跟可汗学院有啥关系"
**作用**：以后 status 汇报先过这份审计再发，不再吹百分比
