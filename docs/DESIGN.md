# UI 设计基线

> 抄 Linear 的克制 + Notion 的呼吸感。
> 应试场景 ≠ 游戏场景，禁止花哨。每个像素都要为「专心做题」让路。

参考来源：[awesome-design-md](https://github.com/VoltAgent/awesome-design-md) → Linear + Notion + Vercel。

## 核心原则

1. **内容为主，UI 退后**：题目占 60% 视觉权重，导航 / 进度条总和不超过 15%
2. **一个屏幕一个动作**：答题页只有「提交」「不会」两个按钮
3. **反馈即时但不打扰**：答对一道题，绿勾 + 0.4s 淡出，不弹框不撒花
4. **暗色模式平等**：不是后想的，是默认要好看

## 字体

| 用途 | 字体 | 备选 | 备注 |
|---|---|---|---|
| Display（标题/品牌） | Smiley Sans | 思源黑体 Heavy | 中文标题不用思源宋，太"AI" |
| Body（正文/题目） | Noto Sans SC | system-ui | 系统字体回落保证国内 CDN |
| Mono（公式/代码/分数） | DM Mono | JetBrains Mono | 数字等宽，分数不抖动 |
| 数学公式 | KaTeX 默认 | — | 不上 MathJax，太重 |

**禁用**：Inter / Roboto / Poppins（AI 千人一面）、思源宋（太编辑部腔）。

## 颜色（OKLCH）

```css
--color-background:        oklch(0.99 0.003 80);   /* 暖白，护眼 */
--color-foreground:        oklch(0.18 0.005 80);   /* 近黑，不死黑 */
--color-muted:             oklch(0.96 0.005 80);
--color-muted-foreground:  oklch(0.45 0.006 80);
--color-border:            oklch(0.92 0.004 80);

--color-primary:           oklch(0.55 0.18 25);    /* 考试红，单点强调 */
--color-success:           oklch(0.62 0.14 150);   /* 提分绿，正反馈 */
--color-warning:           oklch(0.72 0.15 60);    /* 错题橙，警示 */
```

**禁用**：紫蓝渐变、彩虹渐变、霓虹色、低饱和粉。
红色只用于「错」「重要」「primary CTA」三种场景，全站红色出现频次 < 10 处。

## 圆角与阴影

| 元素 | 圆角 | 阴影 |
|---|---|---|
| 按钮 | 6px | 无 |
| 卡片 | 8px | `0 1px 2px rgb(0 0 0 / 0.04)` |
| 模态框 | 12px | `0 8px 24px rgb(0 0 0 / 0.08)` |
| 头像 | 50% | 无 |

**禁组合**：`rounded-3xl` + `shadow-2xl`（AI 设计标志）、玻璃态毛玻璃（性能差且过气）。

## 间距

走 4px 基础栅格，用 Tailwind 默认（4 / 8 / 12 / 16 / 24 / 32 / 48 / 64）。
**禁三列等宽卡片**横向铺满（AI 落地页病）。两列或四列可以，三列必须左右窄中间宽或带主次。

## 排版节奏

- 段落最大宽度 70ch（约 32 中文字符）
- 行高 1.7（中文比英文多 0.1）
- H1 = 32px / H2 = 24px / H3 = 18px / body = 16px
- 数字用 mono，中文用 sans，混排时数字前后留 0.25ch

## 组件库

shadcn/ui 拷贝进 `packages/ui/src/`，不安装，按需粘。已有：
- `Button` — `default / primary / outline / ghost`，三档尺寸
- TODO: `Input`、`Card`、`Dialog`、`Tabs`、`Toast`、`Progress`

## 图标

只用 [lucide-react](https://lucide.dev)，禁混 Heroicons / Tabler / Feather。
图标尺寸跟字号走：16px / 20px / 24px。

## 动效

- 默认 transition 150ms cubic-bezier(0.4, 0, 0.2, 1)
- 答对绿勾：scale 0→1 200ms ease-out + 400ms 后 fade-out
- 页面切换：80ms opacity，禁用 slide / 翻页 / 3D
- `prefers-reduced-motion` 必须尊重，所有动画降为 0ms

## 反 AI Slop 检查清单

发布前自查：
- [ ] 没有紫蓝 / 彩虹渐变
- [ ] 没有 `rounded-3xl shadow-2xl` 组合
- [ ] 没有三列等宽撑满 hero 卡片
- [ ] 没有「赋能 / 智能 / 一站式 / AI 驱动」文案
- [ ] 没有空洞 emoji 装饰
- [ ] 中文标点没乱用冒号 + 破折号

## 商业化检查（按 CLAUDE.md 全局规则）

每个核心页必须有：
- 可见分享按钮（学生周报、错题本周报）
- 个性化文案（带学生名字 + 提分数字）
- 接收者免注册可看预览页（家长不愿装 app 也能扫码看）
