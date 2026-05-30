# Miniapp Reference Asset Decisions

Source library: `C:\Users\86136\Desktop\小程序`

This file records how the HTML/PNG reference package should influence the WeChat miniapp without turning the miniapp into a screenshot mock.

## Direct Use

These are individual product assets and can be copied into `miniprogram/assets/reference/` or `miniprogram/assets/brand/`:

- `brand-house.png`: brand mark for the miniapp header.
- `hero-mascot.png`: main home mascot.
- `2.png` -> `gudian-reader.png`: high-quality Gudian learning companion for AI tutor and child-flow hero scenes.
- `gudian-sticker.png`: bottom encouragement/sticker card.
- `entry-upload.png`, `entry-report.png`, `entry-tutor.png`, `entry-review.png`, `entry-parent.png`, `entry-map.png`: six homepage entry illustrations.

## Reference Only

These are whole-page or composite references. They define layout, scale, density, color, and hierarchy, but must not be used as full-screen backgrounds or hot-zone mockups:

- `assets/img/miniapp-home.png`
- `assets/img/home-desktop.png`
- `assets/img/upload-desktop.png`
- `assets/img/report-desktop.png`
- `assets/img/tutor-desktop.png`
- `assets/img/review-desktop.png`
- `assets/img/parent-desktop.png`
- `assets/img/map-desktop.png`
- `assets/img/mobile-home.png`
- `assets/img/mobile-report.png`

## HTML Reference Rules

The HTML files in `C:\Users\86136\Desktop\小程序` are reference prototypes only:

- Use them to read page hierarchy, card density, and interaction intent.
- Do not import their CSS directly into `miniprogram/`.
- Do not copy DOM classes into WXML when they contain web-only or internal naming.
- Rebuild the UI as native WXML/WXSS so uploads, reports, tutor, review, parent, and map routes remain real miniapp pages.

## Must Be Real Code

These parts cannot be represented by images:

- Entry navigation and tab routing.
- Upload material classification.
- Report evidence, confidence, and method matching.
- AI tutor first-step questioning.
- Review/game memory and transfer validation.
- Parent evidence summary and next action.
- Download/share/export behavior.

## Current Miniapp Direction

- The home first screen follows `assets/img/miniapp-home.png`: brand header, mascot hero, six entry cards, tonight route, progress, and sticker card.
- The miniapp keeps five bottom tabs for current product/test compatibility: Today, AI tutor, review island, parent, upload.
- Whole-page screenshots remain acceptance targets, not runtime assets.

## 2026-05-29 Follow-Up Pass

The latest miniapp pass applies the reference style to the later tabs, not only the home tab:

- AI tutor, review island, parent, and upload now keep a compact focused launch shell plus a visual sub-flow preview underneath.
- The sub-flow preview must include a real illustration asset via `subcheck-art`; it is not allowed to degrade back to text-only white boxes.
- The five main tab headers must use `brand-house.png` or a reference/brand image for the mark. Text-only marks such as `家`, `岛`, `↑`, or robot emoji are treated as old-design regressions.
- Bottom tab labels render at real size; visual scaling such as `scale(0.88)` is not allowed to hide layout pressure.
- AI tutor and core child-flow scenes use `gudian-reader.png` so the learning companion stays visually consistent with the reference package.
- Each later tab exposes two nearby child-flow choices under the main action so users can see the next jump without scrolling.
- `entry-detail` now has a compact three-step proof strip: look at evidence, do one step, return evidence.
- Static contract coverage lives in `scripts/test-miniapp-tab-layout-contract.cjs` and checks the later tabs, subpage support, safe-area spacing, visual sub-flow preview, the Gudian reader asset, and real-device screenshot gate expectations.

## Still Not Done

- Fresh WeChat DevTools/real-device screenshots are still required before claiming visual completion.
- The current DevTools CLI can start the automation server, but `miniprogram-automator` still cannot obtain the websocket target from the open project window.
- The upload gate still requires replacing `touristappid` with the real AppID before production upload.
