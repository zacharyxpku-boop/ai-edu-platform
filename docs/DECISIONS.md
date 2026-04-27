# 架构决策记录 (ADR)

> 一条 ADR = 一次有争议的取舍。
> 没争议的不写。决策可以推翻，推翻时新加一条，不删旧的。

格式：Status / Context / Decision / Consequences。

---

## ADR-001 · 用 pnpm workspaces 而不是 turbo / nx / lerna

- **Status**: Accepted · 2026-04-25
- **Context**: 三层架构需要 monorepo 共享 schema 和教学引擎包。turbo 提供缓存但学习成本高，nx 太重，lerna 已停更。
- **Decision**: 只用 pnpm workspaces，配合 `pnpm -r --filter` 跑跨包脚本。后续如果构建时间 > 90s 再加 turbo。
- **Consequences**:
  - ✅ 配置极简（一个 yaml）
  - ✅ 不锁定工具链
  - ❌ 没有任务编排缓存，CI 上每次全跑
  - ❌ 跨包并行需要手写脚本

---

## ADR-002 · 数据层用 Drizzle ORM 不用 Prisma

- **Status**: Accepted · 2026-04-25
- **Context**: 团队熟 SQL 不熟 Prisma DSL。Prisma 自带 client 体积大且和 RSC 兼容性踩过坑。Drizzle 是 SQL-first，迁移可读。
- **Decision**: Drizzle + drizzle-kit 做迁移，运行时用 postgres.js 驱动。
- **Consequences**:
  - ✅ 类型推导完全不输 Prisma
  - ✅ migrations/*.sql 直接可读，DBA 也能改
  - ✅ 包体积小（< 50KB）
  - ❌ 关系查询语法略繁，需要适应

---

## ADR-003 · MVP 不上独立 API 服务

- **Status**: Accepted · 2026-04-25
- **Context**: monorepo 留了 `apps/api` 占位，但 MVP 阶段直接用 Next.js API routes 够用。
- **Decision**: 后端逻辑全部走 `apps/web/app/api/**`。`apps/api` 只放 README 说明何时拆分。
- **Triggers to split**:
  1. LLM 单次响应 > 30s，Vercel 超时
  2. 长跑任务（OCR 批改、向量化整本教材）需要常驻 worker
  3. WebSocket / SSE 超连接限制
- **Consequences**:
  - ✅ 一把部署，运维成本零
  - ✅ RSC 直接服务端取数，无 BFF 一层
  - ❌ 一旦拆分要重布线，但现在拆是过早优化

---

## ADR-004 · LLM 主力用 DeepSeek 不用 GPT-4

- **Status**: Accepted · 2026-04-25
- **Context**: 苏格拉底对话场景需要中文理解 + 大量 token + 低延迟 + 低成本。GPT-4 贵 30 倍且中文不占优。
- **Decision**: 默认 DeepSeek (`deepseek-chat`)，备选 Qwen (中文长文本) 和 OpenAI 兼容入口（灰度替换用）。
- **Consequences**:
  - ✅ 成本降到 $0.14/1M 输入 token
  - ✅ 中文数学题理解明显优于 GPT-4o-mini
  - ❌ 海外用户访问 DeepSeek 偶发抖动，需要 Qwen 兜底
  - ❌ 监管不确定性：DeepSeek API 在境外被限的可能性 > 0

---

## ADR-005 · Mastery 引擎用 BKT 改造，不用 DKT / IRT

- **Status**: Accepted · 2026-04-25
- **Context**: OATutor 论文给了 BKT 完整公式，工程实现 < 50 行。DKT (Deep Knowledge Tracing) 准确率高 5-8% 但要训练 LSTM，冷启动数据缺。
- **Decision**: 先 BKT，加两条改造（难度 bonus + 超时 slip）。攒到 10 万 attempts 再训 DKT 替换。
- **Consequences**:
  - ✅ 冷启动可用，不需要训练数据
  - ✅ 可解释，能给家长看「pKnown 0.7 → 0.85」
  - ❌ 长期天花板比 DKT 低
  - ❌ 学生在多个知识点共享技能时 BKT 失真（DKT 解决得更好）

---

## ADR-006 · 字体不用 Inter，用思源/Smiley Sans

- **Status**: Accepted · 2026-04-25
- **Context**: 全局规则明确禁 Inter / Roboto / Poppins（AI 千人一面）。学生端中文为主，英文字体不重要。
- **Decision**: Display 用 Smiley Sans，Body 用 Noto Sans SC，Mono 用 DM Mono。
- **Consequences**:
  - ✅ 视觉差异化，不像「又一个 ChatGPT 套壳」
  - ✅ 中文优先，K12 学生体验好
  - ❌ Smiley Sans 字重选择少，需配合字号弥补层级
  - ❌ 字体文件 ~200KB，需做 subset

---

## ADR-007 · 知识点编码格式 `subject.grade.chapter.topic[.subtopic]`

- **Status**: Accepted · 2026-04-25
- **Context**: 题库要打知识点标签，外部题源（GAOKAO-Bench / E-EVAL / ChinaTextbook）格式各异，需要统一编码。
- **Decision**: 强制 `<subject>.<grade>.<chapter>.<topic>[.<subtopic>]` 五段以内。zod 正则强校验。
- **Consequences**:
  - ✅ 解析 / 排序 / 父级查询都可以纯字符串操作
  - ✅ 跨学科一致性强
  - ❌ 跨学科主题（如「函数思想」既出现在数学又出现在物理）需要双标签
  - ❌ 课标改版时所有 code 要批量重映射

---

## ADR-008 · UI 组件抄 shadcn/ui，不引入 antd / chakra

- **Status**: Accepted · 2026-04-25
- **Context**: 应试场景 UI 组件需求小（按钮 / 卡片 / 输入 / 模态 / 标签 / 进度），全套组件库浪费包体积。
- **Decision**: shadcn/ui 「拷贝不安装」，只把用到的组件粘到 `packages/ui/src/`。
- **Consequences**:
  - ✅ 包体积可控
  - ✅ 完全可改，不被设计 token 锁死
  - ❌ 升级时手动同步
