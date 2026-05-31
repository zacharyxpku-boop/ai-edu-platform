# Web UI Handoff

This folder is the only place for website UI work.

## What to send me

Best input order:

1. Reference screenshots from GPT, competitors, or your own sketches.
2. Variant code when available.
3. Notes about what must feel identical to the miniapp and what should become more website-like.

Screenshots are enough for direction. Variant code is useful for exact spacing, component anatomy, and responsive behavior, but it should be treated as reference material, not production code to paste blindly.

## Where references go

- Put screenshots under `apps/web/design-references/screenshots/`.
- Put Variant exports under `apps/web/design-references/variant/`.
- Put short notes under `apps/web/design-references/notes/`.

These files are web-only references. They must not be copied into `miniprogram/` or `apps/app/`.

## Design target

The website should carry the same product promise as the miniapp:

- Upload materials and classify evidence.
- Generate a parent-facing personalized report.
- Route the child into the first tutor question.
- Turn wrong causes into review/game challenges.
- Give the parent a clear summary and next step.

The website should not become one long scroll. The first screen should make every entry obvious, then each entry opens a focused subpage.

## Implementation rule

Use the miniapp as product parity, not as source code.

- Miniapp parity lives in `surface-manifest.json`.
- Shared business logic belongs in `packages/edu-core`.
- Shared page data contracts belong in `packages/ui-contracts`.
- Web UI, CSS, browser routing, PDF export UI, and responsive layout stay in `apps/web`.

## Current UI baseline

The accepted reference is the HTML/PNG package at `C:\Users\86136\Desktop\小程序`.

Use this baseline for all three surfaces:

- Product structure: left nav or bottom tabs, top student/family status, six clear entries, report preview, tonight route, evidence/progress rail.
- Core entries: 上传资料、个性化报告、AI私教、复习岛、家长中心、今晚路径.
- Visual language: warm off-white background, green primary, yellow/blue/orange accents, 24px-style rounded cards, soft shadows, friendly mascot/illustration blocks.
- Navigation rule: do not stack everything into one long scroll; each entry must open a focused page/state.
- Asset rule: mascot and illustrative PNGs can be used directly; interaction surfaces must remain real DOM/WXML, not one big background image with hot zones.

Implementation boundaries:

- `apps/web` owns the website prototype and official `/app` preview.
- `miniprogram` owns WeChat miniapp WXML/WXSS and must not import web CSS.
- Future native app work should consume the same content contracts and visual tokens, not copy web or miniapp files directly.

## 2026-05-29 Shell Alignment

The Web shell now follows the same asset discipline as the miniapp:

- Brand mark, sidebar navigation, mobile tabs, family pill, entry cards, report preview, tutor avatar, review game cards, parent evidence cards, and map nodes use PNG assets from `apps/web/assets/reference/`.
- Symbol-only navigation marks such as `⌂`, `⇧`, `☻`, `♙`, emoji family marks, and CSS-only brand icons are treated as old-design regressions.
- The review page uses the green/yellow/blue/orange palette from the miniapp references; purple challenge cards are not part of the accepted baseline.
- `apps/web/scripts/check-web-surface.cjs` enforces these shell rules so future edits cannot silently drift back to the old symbolic UI.
