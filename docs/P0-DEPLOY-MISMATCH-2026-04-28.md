# 🚨 P0 · Vercel 部署内容 ≠ origin/main 内容

**严重程度：阻塞**所有依赖前端代码的事项（包括今天 commit e5dd599 / e41d57a / a89a810 全部前端工作）

---

## 事实证据（curl 实测，非推测）

### 证据 1：线上 tutor.html ≠ repo main 上的 tutor.html

```bash
$ curl -sL "https://yuandianzhixue.com/tutor.html" | wc -l
405

$ wc -l tutor.html  # 本地 = origin/main 同步
918
```

### 证据 2：CSS 变量名都不一样

| 文件 | line 6 title | 关键 CSS 变量 |
|---|---|---|
| 线上 405 行 | 原点 AI 私教 · **这个老师记得你** | `--c-warm-white: #F5F0EB` + `--c-ink: #1A1A2E`（深紫蓝底！） |
| 本地 918 行 = origin/main | 原点 AI 私教 · **莫小语** | `--warm-white: #FAFAF7`（暖白底）|

变量命名规则都不同（`--c-` 前缀 vs 无前缀），不可能是同一文件演化的两版。

### 证据 3：origin/main tutor.html blob 校验通过

```
$ git ls-tree origin/main -- tutor.html
100644 blob c11f4a4cb67dd12774a2874c7ecf2e9df589dce7	tutor.html

$ git ls-tree HEAD -- tutor.html
100644 blob c11f4a4cb67dd12774a2874c7ecf2e9df589dce7	tutor.html
```

origin 和 local 一致，git push 链路没问题。

### 证据 4：用户截图深底吉祥物对应的是线上 405 行版本，不是任何我 commit 过的版本

线上 line 9-10：`--c-ink: #1A1A2E` 是深紫蓝色 → 完美匹配用户最早怒喷那张深底截图。

之前我误以为是 CDN cache 没刷，实际上**线上一直是另一个文件**，从来没 serve 过我提交的浅底三栏版。

---

## 根因假设（按优先级）

### 假设 A · Production branch 不是 main（最可能）

Vercel project 设置里 Production Branch 可能配置的是 `production` 或 `prod`，main push 进去只触发 preview deployment 不上线。

**你侧验证**：
1. 登 Vercel Dashboard
2. 进 yuandian-ai-tutor (或对应) project
3. Settings → Git → Production Branch
4. 看是不是不是 main

**如果是**：要么改成 main，要么我们把 commit 推到那个 branch。

### 假设 B · Vercel project 已断开 GitHub 集成

某个时间点 Vercel ↔ GitHub OAuth 失效，新 commit 不再触发 deploy。
线上 serve 的是上次成功 deploy 的版本（可能几周前的）。

**你侧验证**：
1. Vercel Dashboard → yuandian-ai-tutor → Deployments
2. 看最新一条 deployment 时间戳
3. 跟最新 commit `3fe2c5cc` 时间对比

**如果差距 > 1 小时**：deploy hook 断了，重新连 GitHub。

### 假设 C · 域名指向了旧 Vercel project

yuandianzhixue.com 可能挂在另一个我们没维护的 project 上。

**你侧验证**：
1. Vercel Dashboard → 顶部 team/personal 切换看所有 project
2. 找哪个 project 绑定了 yuandianzhixue.com domain
3. 跟正在改代码的 ai-edu-platform repo 是不是同一个

---

## 我侧已做的（不动了，等你查 Vercel）

- 不再 commit 新前端代码（再 commit 也不会上线）
- 不再 commit 新 docs（同样不会同步）
- 不再 ScheduleWakeup 启动新 loop 心跳

等你 Vercel 后台诊断完告诉我哪个假设命中，我再针对性出动作：
- 假设 A 命中 → 改 production branch 配置 / 或 PR 到对应 branch
- 假设 B 命中 → reconnect GitHub + 触发 redeploy
- 假设 C 命中 → 把 domain rebind 到正确 project

---

## 阁主自查 · 这件事暴露的反模式 D（补 SESSION-LOG）

> **反模式 D：「git push 成功就当 ship 成功」**
>
> 症状：今天连续 push 9 个 commit 都拿到「3acd...->main」success 提示，于是默认线上跟 main 同步。
> 真相：push 到 GitHub ≠ 部署到 Vercel ≠ 用户看到。中间任何一段断裂都让 commit 变成纸面动作。
>
> 纠正：每次「ship」claim 后必须做 1 件之中：
> 1. WebFetch / curl 抓线上看真渲染（覆盖前端）
> 2. curl 调线上 API 看真返回（覆盖后端）
> 3. 看 Vercel deployment 时间戳跟 commit 时间戳是否对得上
>
> 这条比 SESSION-LOG 反模式 A（grep 本地当 ship）更上游 —— A 是验证错位，D 是部署链断了根本没机会被验证。

---

**版本**：v1.0 · 2026-04-28 23:00 发现
**触发**：用户问"给我看看现在的产品"我去 curl 才发现的
**等你**：Vercel Dashboard 排查 + 告诉我哪个假设命中
