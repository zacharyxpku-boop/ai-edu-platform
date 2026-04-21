# 原点智学 · 产品线内阁审计（2026-04-21）

阁主召 · 造化三组 + 镜鉴一组 · 覆盖 17 工具 / 10 顶级页 / 18 知识库文件。本文只给判断和落地清单，不复述细节。

---

## 一、一句话体检

**骨架齐、方法空、皮不匀、页打架。**

- **骨架**：17 工具 100% 真接 `YdzxAI.call`（DeepSeek/豆包/千问/OpenAI），`LearningStore` 与 `share-kit` 基建已通——属于"能上线"级。
- **方法**：`src/curriculum/` 只有素材（学科 json + 艺术画册 + 书单），**没有任何一份方法论数据**。费曼 rubric、错题归因、诊断量表、家长讲义全部为零。产品看着全，内里空。
- **皮**：4 个内容工具（art/music/reading/note-enhancer）还穿旧深蓝紫玻璃卡，外壳已是米白 `#FAFAF7`——两层打架。
- **页**：`assistant.html` 和 `methods.html` 是**两份少年营报名页**；`index` 和 `study-tools` 的 meta description 一字不差；`about` 和 `about-brand` 分页冗余；`tools-guide` 名字骗人。

---

## 二、17 工具分层（合并三组造化评分）

按总分 + 战略重要性归 4 层。分数越高越好，均为 30 分制。

### Tier S · 付费转化枢纽（1 件）
- **exam-diagnosis**（25）三步向导 + 13 维雷达 + 错题录入 + 跳 error-mastery 串联，闭环最完整。**P1 杠杆**：加「本次 vs 上次」虚线叠图 + 诊断后追问入口，能升级成赛季式主线。

### Tier A · 真功能工具（5 件 · 值得加钱）
- **note-enhancer**（22）四维打满「学得快」，升级钩子：接 FSRS 间隔复习 + 思维导图节点深钻 + 批量汇编成书
- **knowledge-arcade**（24.5）唯一真游戏化（打地鼠/消消乐/贪吃蛇/推箱子 + combo），升级：日榜 + 错打题回流 error-mastery + 饱和度收敛
- **feynman-verify**（22）多轮对话最正，升级：通关金句卡 + 7 天后 FSRS 触发 + 盲区结构化
- **error-mastery**（18）教研含量最高，升级：3 道变式必须在线做才算通关 + 家长汇报卡
- **learning-profile**（21）全站数据聚合仪表盘，升级：本周 vs 上周对比 + 段位赛季 + AI 本周教练点评

### Tier B · 能用但单薄（8 件 · 加功能才能出圈）
- exam-generator · study-plan · essay-grading · reading-rewriter · knowledge-explain · art-thinking · global-picks · music-appreciation

### Tier C · 退役或降级（3 件）
- **scoring-breakdown**（12）一次性表单 → 静态结果 → 刷新丢失。**下架**，并入 exam-diagnosis 作为错题子模块。
- **knowledge-visual**（14）不落盘、无追问、功能薄。**降级**为 note-enhancer 的子按钮「生成图」。
- **music-appreciation**（14）无音频的音乐鉴赏是伪需求。**合并**进 art-thinking 做「艺术鉴赏」统一入口。

---

## 三、知识库三大空洞（P0 级）

| 空洞 | 严重性 | 后果 |
|---|---|---|
| 方法论层全空 | P0 | 七大 Vol1 模块除素材外零方法，产品看着全、接不住 |
| Vol2 思维锻造裸奔 | P0 | 这是原点最核心壁垒，批判/系统/创造训练卡一张都没有，壁垒让给竞品 |
| 家长线完全空白 | P0 | BP v3 承诺四大收入支柱之一，`src/curriculum/` 零内容。承诺跳票风险。 |

**明天就能补齐的 3 个**：
1. `feynman-prompts.json` — 20 条四步 prompt + 三档 rubric（0.5 天）
2. `mistake-taxonomy.json` — 三层错题归因标签（1 天）
3. `parent-l1-curriculum.json` + 讲义骨架 — 6 节觉醒课目录 + 每节 800 字主张 + 3 个家庭练习（1 天）

**题库现状**：数学 Ape210K + Math23K + TAL 三套 sample 约万题级，MVP 冷启动够用；**物理/化学/生物题库空白**（仅 knowledge map，无题）。补齐顺序：物理 > 化学 > 生物。

---

## 四、信息架构 4 处手术

1. **砍 methods.html**：它和 assistant.html 都是少年营报名页（重写了两遍）。保留 assistant 版改名 `camp.html`，methods 301 过去。
2. **改 tools-guide.html 名**：实际内容是 AI 学伴产品页，改 `ai-companion.html`；"工具指南"这个词留给未来真要做的使用手册。
3. **合 about**：`about.html` + `about-brand.html` 合成理念在上团队在下单页，另一个 301。
4. **分 index/study-tools 职责**：首页讲品牌和四维主张，工具聚合页讲完整 17 工具网格。meta description 必须差异化写。

**Nav 收口**到 5 入口：首页 / 产品（学伴+少年营+会员）/ 工具箱（study-tools+prompts）/ 研究院（articles）/ 关于。`settings` 沉到用户菜单。

---

## 五、P0 立刻动手清单（本轮执行）

- [ ] **A1** 皮肤统一：art / music / reading / note-enhancer 的深蓝紫玻璃卡改米白 `var(--card)`
- [ ] **A2** 少年营合并：assistant 改名 camp，methods 301
- [ ] **A3** scoring-breakdown 下架并重定向
- [ ] **A4** index 和 study-tools 的 meta description 差异化重写
- [ ] **A5** 三个知识库文件补齐（派内阁代笔）：feynman-prompts / mistake-taxonomy / parent-l1
- [ ] **A6** error-practice 加在线作答 + AI 判分 + 错题池写入

## 六、P1 两周内做

- Tier S 工具 exam-diagnosis 加赛季叠图 + 追问入口
- Tier A 五件各自补最大一条升级建议
- 物理题库从菁优网/组卷网扒 500 道计算题打标
- 家长 L1 六节讲义正文（跟骨架补全）

## 七、P2 月内做

- Vol2 思维训练卡（批判/系统/创造三类各 20 张）
- FSRS 接入 note-enhancer 和 feynman-verify
- knowledge-arcade 错打题回流到 error-mastery
- Nav 五入口重构

---

**签字**：造化 ×3（核心/互动/内容）、镜鉴 ×1（知识库+IA）。阁主合议后由本机执行官落地。
