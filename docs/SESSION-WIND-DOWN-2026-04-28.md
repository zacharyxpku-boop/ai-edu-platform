# Session Wind-down · 2026-04-28 全程总览

> 给 5/4 demo 前一夜读 · 5 分钟看完整周做了什么、下一步赌什么

---

## 三 tag 三阶段

| Tag | 时间 | 心态 | 一句话 |
|---|---|---|---|
| `v1.0-ka-wave` | 当天上半场 | 造轮子 | 把可汗学院 7 个原型 1:1 中文化（学科枢纽 / mastery map / streak / Up Next / 冲关 / 家长视图 / 时段卡） |
| `v1.1-experiment-wave` | 当天傍晚到夜间 | 测假设 | 6 候选改进 → 4 EXP 落地（含 1 个 sunset），写 EXPERIMENT-WEEK 文档 |
| `v1.1.1-observability-hardened` | 深夜场 | 工程化 | 埋点 + npm test + CI · 让假设有数据可验，main 不被破坏 |

---

## 高层数据

- 总 commit ~50（v1.0 起算）/ session 跨度 < 24h
- 7 文档（KA-LOCALIZE-MILESTONE / EXPERIMENT-WEEK / OBSERVABILITY / V1.0-TO-V1.1-DIFF / 3 SESSION-LOG）
- 1 sunset doc（EXP-1 英语 OCR blocker）
- 9 个事件埋点 name + 11 页 PV 自动登记
- 8 case observability 回归 + 499 静态 link 检查
- 1 GitHub Action workflow · push/PR 触发
- 4 实验落地（2/3/4 shipped + 1 sunset）

---

## 设计原则归纳（在文档外可独立流通）

1. **反 dopamine 优于推动力**：quiz 10 连对劝退、家长卡反虎妈状态文案、mastery delta 不显示退步
2. **诚实降级优于伪交付**：英语 manifest sunset 改 placeholder 为 "PDF 已收 OCR 中"
3. **文档先行优于直觉行动**：EXPERIMENT-WEEK 写完后自动砍掉两个 P2 直觉项
4. **公共抽象优于内联实现**：trackEvent 内联 4 commit 后才抽 src/track.js · 下次 >1 页面就直接抽
5. **测试常驻优于事后审计**：streak 算法 hardcode 在 assert · CI 拦改坏的人

---

## 仓内文件目录速查

```
README.md                         · GitHub 落地页 5 徽章 + 4 入口分流
docs/
  KA-LOCALIZE-MILESTONE-v1.md     · v1.0 交付清单 7 模块
  EXPERIMENT-WEEK-v1.1.md         · v1.1 6 EXP 假设/止损/排期
  OBSERVABILITY-MINIMAL.md        · 6 段 console snippet + npm test 工作流
  V1.0-TO-V1.1-DIFF.md            · 阶段对照 + 5/4 demo checklist
  SESSION-LOG-2026-04-28-pm.md    · 中场 standup
  SESSION-LOG-2026-04-28-night.md · 深夜场 standup
  SESSION-WIND-DOWN-2026-04-28.md · 本文档（全程总览）
  sunset/EXP-1-english-blocker.md · 失败实验审计

scripts/
  observability-dry-run.cjs       · 8 case · streak/event/funnel 回归
  check-static-links.cjs          · 499 内部 link 检查

src/
  track.js                        · 公共埋点 (window.YDZX_TRACK)
  subject-hub.js                  · 学科 hub 渲染引擎
  streak-bar.js                   · 连续学习天数组件
  today-recos.js                  · 跨页 Up Next banner

.github/workflows/
  test.yml                        · push/PR 跑 npm test
```

---

## 5/4 demo 当天最低限度

> 这是 V1.0-TO-V1.1-DIFF 第 7 节的 9 项 checklist 的精简版

不要新加功能。当天动作：
1. `git pull origin main` → `git log --oneline -1` 看到 main 最新 commit
2. `npm test` 全绿（observability 8 + 静态链接 499）
3. 走演示动线：注册 → 数学 hub → quiz 答错 → 错题攒 5 道冲关 → progress 看战利品 → 复制家长简报 → 生成图卡
4. 演示后 DevTools Console 跑 OBSERVABILITY 第 5 段 snippet 当场看真实事件分布
5. 拿到的访谈 / 数据回头记 docs/sunset/ 或 EXPERIMENT-WEEK 状态板

---

## 5/5 拍版日决策点

> 数据观察 checklist 在 EXPERIMENT-WEEK 文档 W1 段，简版：

- EXP-2 7 日二访率：升 → 留；降 → 撤回月度 delta
- EXP-3 streak_4 触发用户 < 10：阈值降到 streak_2
- EXP-4 图卡按钮点击率 < 5% 或 utm 注册 < 3/周：撤回图卡按钮
- 任何 EXP 撤回都写 docs/sunset/ 留审计

---

## 不在本周做但要记住

- 英语 manifest（OCR pipeline 解锁后再启）
- AI 私教 V2 prompt（PROMPT_VERSION=v2 默认关）
- 章节考点细分到概念/应用/综合（EXP-5 W3 起步）
- 移动端底部 tab bar（EXP-6 看 mobile UA 分布）
- LLM rerank v2 confidence-aware（low confidence-only）

---

## 终末反思

最具杠杆的两个动作：
- 写 EXPERIMENT-WEEK 让 17 commit 从主观变客观
- 抽 trackEvent 让 11 页 PV 自动登记 1 行接入

最遗憾的是 trackEvent 抽得晚 4 commit；最庆幸的是 EXP-1 30 分钟调研抵 6h 错误投入。

下次新方向起步先做两件事：写 hypothesis 文档 + 决定是否抽公共。

---

> Session 结束。下一次 `/loop` 触发时 `git pull` + `npm test` 看基线，再开新支线。
