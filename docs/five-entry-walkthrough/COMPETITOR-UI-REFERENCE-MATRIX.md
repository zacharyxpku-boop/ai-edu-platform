# Five Entry UI Reference Matrix

Generated: 2026-05-24

This is the working benchmark for the five main miniapp tabs. It is a design-study reference, not a license to copy competitor trademarks, exact artwork, or proprietary layouts. The implementation should reproduce the interaction intent, visual hierarchy, density, and child-friendly affordances while using YuanDian-owned copy and assets.

## Primary Local Reference

- `miniprogram/assets/ui-kit.png`
- Applied assets:
  - `/assets/brand/gudian-mascot.png`
  - `/assets/brand/gudian-mascot-study.png`
  - `/assets/brand/review-sprout.png`
  - `/assets/brand/family-report.png`

## Competitor Lessons Applied

| Product | Local reference | Pattern to borrow | YuanDian tab |
| --- | --- | --- | --- |
| Khan Academy Kids / 斑马AI学 | `references/ui-competitors/images/banma-*.png`, Khan Kids website screenshot | Friendly central character, low text, playful learning world | Today, Upload, Tutor |
| Duolingo | `references/ui-competitors/pages/duolingo-home.png` | One obvious start CTA, mascot-led motivation, low-friction first action | Today, Arcade |
| Quizlet | `references/ui-competitors/images/quizlet-*.jpg` | Material becomes cards, self-check scale, study modes below the main action | Upload, Arcade |
| ClassDojo | `references/ui-competitors/pages/classdojo-home.png` | Parent sees progress and confidence evidence, not operational dashboards | Parent |
| 小猿AI / 作业帮 | `references/ui-competitors/images/xiaoyuan-kousuan-*.png`, `zuoyebang-*.png` | Homework entry is concrete and fast; action buttons explain the next step | Today, Upload |
| Khanmigo / Synthesis | `references/ui-competitors/pages/khanmigo-home.png`, `synthesis-home.png` | Tutor should feel guided and credible, not like a generic answer bot | Tutor |

## Current Implementation Standard

- 首屏只放一个主任务、一个主 CTA、少量辅助入口。
- 默认不靠下拉解释产品；子页面承接细节。
- 学生入口用任务语言：开始、5 分钟、说第一步、生成学习包。
- 家长入口用证据语言：今晚安排、一句话周报、关键进展。
- 吉祥物必须使用本地视觉资产，不再使用临时 CSS 简笔画。

