# Miniapp Reference Adoption

This is the miniapp-side source of truth for adopting the HTML/PNG prototype library at `C:\Users\86136\Desktop\小程序`.

The goal is not to paste screenshots into the product. The miniapp must stay as real WXML/WXSS/JS, use production-safe sliced assets, and keep each entry clickable.

## Direct-Use Assets

These files are allowed and expected in production miniapp UI:

| Asset | Production path | Used for |
| --- | --- | --- |
| `brand-house.png` | `miniprogram/assets/reference/brand-house.png` | brand marks in home, child pages, upload, tutor, review, parent, and web parity |
| `hero-mascot.png` | `miniprogram/assets/reference/hero-mascot.png` | companion hero moments; replaces generated/placeholder mascot variants |
| `gudian-sticker.png` | `miniprogram/assets/reference/gudian-sticker.png` | compact reward/sticker moment on the home surface |
| `entry-upload.png` | `miniprogram/assets/reference/entry-upload.png` | upload entry, material classification, upload proof rail |
| `entry-report.png` | `miniprogram/assets/reference/entry-report.png` | report entry, evidence preview, report child scene |
| `entry-tutor.png` | `miniprogram/assets/reference/entry-tutor.png` | AI tutor entry, first-step prompt, tutor child scene |
| `entry-review.png` | `miniprogram/assets/reference/entry-review.png` | review/game entry, recall and transfer proof |
| `entry-parent.png` | `miniprogram/assets/reference/entry-parent.png` | parent center, family action card, parent child scene |
| `entry-map.png` | `miniprogram/assets/reference/entry-map.png` | learning map, tonight route, five-step loop |

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
| Review/game | review and arcade pages validate memory, transfer, and wrong-cause repair |
| Parent center | profile page summarizes evidence and the next family action |
| Web parity | `apps/web` uses its own HTML/CSS/JS and only mirrors assets/contracts, never miniapp WXML/WXSS |

## Forbidden Regressions

- Do not use whole-page PNGs as tappable UI backgrounds.
- Do not restore symbolic placeholder nav marks such as house/arrows/robot/family chess icons.
- Do not restore retired decorative layers, retired secondary preview tails, old hero shell names, or dense old gameplay shells on the first screen.
- Do not make a child entry CTA point back to the same child scene.
- Do not leave any supported entry without real `bindtap` routing.
- Do not mix web implementation files into `miniprogram/`, or miniapp WXML/WXSS into `apps/web/`.

## Current Image2 Asset Need

No extra Image2 asset is required to pass the current UI contract. The current direct-use assets cover the brand mark, mascot, six entries, route rail, report preview, review map, and parent action card.

Optional future assets that would improve fidelity if generated cleanly:

| Optional asset | Why it would help |
| --- | --- |
| `gudian-fullbody-transparent.png` | richer child/tutor hero moments without cropping |
| `report-radar-card-illustration.png` | higher-fidelity report evidence panel |
| `tutor-socratic-board-transparent.png` | clearer first-step tutor workspace |
| `review-world-map-transparent.png` | richer review/game map without rebuilding complex art in WXSS |
| `family-avatar-group-transparent.png` | stronger parent center visual |
| `learning-route-map-transparent.png` | more polished map/today route scene |

## Verification

The following checks enforce this adoption standard:

- `node scripts/test-miniapp-reference-adoption.cjs`
- `node scripts/test-miniapp-tab-layout-contract.cjs`
- `node scripts/test-miniapp-click-contract.cjs`
- `npm run miniapp:real-device-gate` once WeChat DevTools service port is open and fresh screenshots are captured
