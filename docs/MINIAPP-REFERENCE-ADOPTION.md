# Miniapp Reference Adoption

This is the miniapp-side source of truth for adopting the HTML/PNG prototype library at `C:\Users\86136\Desktop\小程序`.

The goal is not to paste screenshots into the product. The miniapp must stay as real WXML/WXSS/JS, use production-safe sliced assets, and keep each entry clickable.

## Direct-Use Assets

These files are allowed and expected in production miniapp UI:

| Asset | Production path | Used for |
| --- | --- | --- |
| `brand-house.png` | `miniprogram/assets/reference/brand-house.png` | brand marks in home, child pages, upload, tutor, review, parent, and web parity |
| `hero-mascot.png` | `miniprogram/assets/reference/hero-mascot.png` | companion hero moments; replaces generated/placeholder mascot variants |
| `2.png` | `miniprogram/assets/brand/gudian-reader.png` | promoted high-quality Gudian reader/learning companion asset; keep it as a sliced character asset, never as a page background |
| `gudian-sticker.png` | `miniprogram/assets/reference/gudian-sticker.png` | compact reward/sticker moment on the home surface |
| `entry-upload.png` | `miniprogram/assets/reference/entry-upload.png` | upload entry, material classification, upload proof rail |
| `entry-report.png` | `miniprogram/assets/reference/entry-report.png` | report entry, evidence preview, report child scene |
| `entry-tutor.png` | `miniprogram/assets/reference/entry-tutor.png` | AI tutor entry, first-step prompt, tutor child scene |
| `entry-review.png` | `miniprogram/assets/reference/entry-review.png` | short-review entry, recall and transfer proof |
| `entry-parent.png` | `miniprogram/assets/reference/entry-parent.png` | parent center, family action card, parent child scene |
| `entry-map.png` | `miniprogram/assets/reference/entry-map.png` | learning map, tonight route, five-step loop |
| `gudian-fullbody-transparent.png` | `miniprogram/assets/reference/gudian-fullbody-transparent.png` | higher-fidelity home and web companion hero |
| `upload-folder-stack-transparent.png` | `miniprogram/assets/reference/upload-folder-stack-transparent.png` | tactile upload and material-classification hero |
| `report-radar-card-illustration.png` | `miniprogram/assets/reference/report-radar-card-illustration.png` | report evidence preview and parent report decision card |
| `tutor-socratic-board-transparent.png` | `miniprogram/assets/reference/tutor-socratic-board-transparent.png` | AI tutor first-step/Socratic workspace hero |
| `review-world-map-transparent.png` | `miniprogram/assets/reference/review-world-map-transparent.png` | short-revisit map hero without restoring old arcade UI |
| `family-avatar-group-transparent.png` | `miniprogram/assets/reference/family-avatar-group-transparent.png` | parent center family-collaboration hero |
| `learning-route-map-transparent.png` | `miniprogram/assets/reference/learning-route-map-transparent.png` | tonight route / product-loop hero |

The same direct-use assets must also exist under `apps/web/assets/reference/` with identical file sizes, so web and miniapp remain visually aligned without sharing code.

## Reference-Only Inputs

These prototype files are visual references only:

| Source | Decision |
| --- | --- |
| `C:\Users\86136\Desktop\小程序\assets\img\miniapp-home.png` | reference for mobile density, card scale, and mascot placement |
| `C:\Users\86136\Desktop\小程序\assets\img\home-desktop.png` | reference for web shell layout, not miniapp WXML |
| `C:\Users\86136\Desktop\小程序\assets\img\upload-desktop.png` | reference for material classification language and upload visual hierarchy |
| `C:\Users\86136\Desktop\小程序\assets\img\report-desktop.png` | reference for evidence-first report cards |
| `C:\Users\86136\Desktop\小程序\assets\img\tutor-desktop.png` | reference for Socratic tutor workspace |
| `C:\Users\86136\Desktop\小程序\assets\img\review-desktop.png` | reference for review map and challenge visuals |
| `C:\Users\86136\Desktop\小程序\assets\img\parent-desktop.png` | reference for parent-readable evidence summaries |
| `C:\Users\86136\Desktop\小程序\assets\img\map-desktop.png` | reference for route-map structure |
| `index.html`, `upload.html`, `report.html`, `tutor.html`, `review.html`, `parent.html`, `map.html` | reference for layout and copy hierarchy; do not import into `miniprogram/` |
| `mobile-home.html`, `mobile-report.html`, `miniapp-home.html` | reference for mobile rhythm; do not copy emoji/icon placeholder UI into production |

## Reference HTML Copy Boundaries

The HTML prototypes are allowed to guide spacing, hierarchy, card density, and asset placement. They are not a copy source for retired product language.

Do not carry over legacy gamification copy from the reference HTML into miniapp or web production UI, especially `复习游戏`, `挑战`, `闯关`, `奖励`, `勋章`, or any arcade-like wording. In production, these areas must be reframed as short revisit, evidence, first-step reasoning, transfer validation, and parent next action.

## Ignored Reference-Library Files

The prototype folder also contains browser/runtime artifacts that must never be copied into the product:

| Source pattern | Decision |
| --- | --- |
| `_chrome-profile*` | Chrome profile cache from screenshot/debug sessions; ignore entirely |
| `Crashpad*`, `GPUCache`, `ShaderCache`, `Code Cache`, `Service Worker`, `Local Storage`, `Session Storage` | browser runtime files; ignore entirely |
| root UUID-named PNGs unless explicitly promoted into `assets/img/` or `assets/reference/` | unreviewed image outputs; keep out of production UI |
| `_screenshots/*.png` | review evidence only; do not ship as UI assets |

## Must Be Implemented In Code

These pieces must stay as editable product code:

| Product area | Required implementation |
| --- | --- |
| Six home entries | real WXML cards using `openEntryDetail` and `data-scene` for `upload`, `report`, `tutor`, `review`, `parent`, `today` |
| Child scenes | `pages/entry-detail/entry-detail` owns the six focused scenes and in-place child switching |
| Functional flows | primary/secondary CTAs use registered miniapp routes through `navigation.navigateLearningRoute` |
| Material intake | upload page keeps classification and evidence handling in JS, not as a static mock |
| Report reasoning | report child scene explains evidence, confidence, and method matching before parent handoff |
| AI tutor | tutor page keeps answer-safe Socratic first-step behavior |
| Review/revisit | `pages/review/review` validates memory, transfer, and wrong-cause repair; the retired `pages/arcade` shell must stay removed |
| Parent center | profile page summarizes evidence and the next family action |
| Web parity | `apps/web` uses its own HTML/CSS/JS and only mirrors assets/contracts, never miniapp WXML/WXSS |

## Forbidden Regressions

- Do not use whole-page PNGs as tappable UI backgrounds.
- Do not reference `assets/img/*.png`, root UUID PNGs, or screenshot exports from WXML/WXSS/web CSS/JS; those are acceptance references, never runtime assets.
- Do not restore symbolic placeholder nav marks such as house/arrows/robot/family chess icons.
- Do not restore retired decorative layers, retired secondary preview tails, old hero shell names, or dense old gameplay shells on the first screen.
- Do not make a child entry CTA point back to the same child scene.
- Do not leave any supported entry without real `bindtap` routing.
- Do not restore `pages/arcade`; short revisit is owned by `pages/review/review`.
- Do not mix web implementation files into `miniprogram/`, or miniapp WXML/WXSS into `apps/web/`.

## Current Image2 Asset Need

No extra Image2 asset is required now. The previous fidelity-gap assets have been generated, copied into both production reference directories, and adopted for the highest-impact hero/large-illustration slots.

Keep future image additions transparent, asset-only PNGs instead of full-page screenshots. Do not bake UI copy, buttons, labels, or page backgrounds into the art; WXML/WXSS and web HTML/CSS must still own layout, copy, routing, and state.

Image2 assets now available and approved for production UI:

| Asset | Current use |
| --- | --- |
| `gudian-fullbody-transparent.png` | home/web companion hero and map encouragement |
| `upload-folder-stack-transparent.png` | upload page hero and upload child-scene hero |
| `report-radar-card-illustration.png` | report hero, home report preview, parent decision card |
| `tutor-socratic-board-transparent.png` | tutor page hero and tutor child-scene hero |
| `review-world-map-transparent.png` | review page hero/world map and review child-scene hero |
| `family-avatar-group-transparent.png` | parent page hero and parent child-scene hero |
| `learning-route-map-transparent.png` | home/map route hero and today child-scene hero |

Recommended Image2 prompt shape for these assets:

```text
Create a transparent PNG illustration asset for a playful Chinese AI education miniapp. No text, no UI chrome, no logo, no page background. Soft rounded 3D illustration style, warm cream/green/yellow palette, child-friendly but polished, suitable to place inside WXML cards. Object: [asset description]. Keep the object centered with safe margins and transparent background.
```

## Verification

The following checks enforce this adoption standard:

- `node scripts/test-miniapp-reference-adoption.cjs`
- `node scripts/test-miniapp-tab-layout-contract.cjs`
- `node scripts/test-miniapp-click-contract.cjs`
- `npm run miniapp:real-device-gate` once WeChat DevTools service port is open and fresh screenshots are captured
