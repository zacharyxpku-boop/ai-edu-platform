# Web App Handoff

This is the current handoff for the new official-site Web app surface.

## Current State

The Web app is implemented as a no-build static prototype inside `apps/web`:

- `index.html`: shell, left rail, top bar, content outlet, right rail.
- `src/routes.js`: six-entry route contract.
- `src/view-model.js`: static Web demo data and page-guide contract used by the renderer.
- `src/app.js`: page rendering, hash routing, right-rail context, and interaction binding.
- `src/styles.css`: responsive visual system and page layouts.
- `assets/brand/`: Web-owned copies of brand imagery.
- `scripts/check-web-surface.cjs`: Web surface gate.
- `scripts/check-web-interactions.cjs`: Web interaction and UX-flow gate, including search, actions, toast, print, page guide, intake pipeline, and report confidence sections.
- `scripts/check-official-preview.cjs`: local `/app/` shell and asset loading gate.
- `OFFICIAL-SITE-ROLLOUT.md`: official-domain rollout boundary and routing options.
- `OFFICIAL-DEPLOY-CHECKLIST.md`: exact deploy and live-check sequence for `https://yuandianzhixue.com/app`.
- `../../app/index.html`: thin official-site preview shell for `/app`, loading CSS/JS from `apps/web`.

Run locally:

```bash
npm run web:dev
```

Open:

```text
http://127.0.0.1:3001
```

Review the official-site preview shell:

```bash
npm run web:dev:site
```

Open:

```text
http://127.0.0.1:3002/app/
```

Capture the current desktop/mobile review screenshots for the direct Web app:

```bash
npm run web:capture
```

Screenshots are written to `docs/web-app-preview/*-current.png`.
The capture set includes all six desktop routes and all six mobile routes.

Capture the same six routes through the official `/app` preview shell:

```bash
npm run web:capture:site
```

Those screenshots are written as `docs/web-app-preview/site-*-current.png`.
Use them to catch drift between `apps/web/index.html` and `app/index.html`.

## Product Entries

| Entry | Route | Current Output | Product Role |
| --- | --- | --- | --- |
| Home overview | `#home` | Six entry cards, report preview, route strip | Let a family understand the whole loop in one screen |
| Upload materials | `#upload` | Drop zone, material types, recent files | Turn non-standard family materials into evidence |
| Personalized report | `#report` | Student banner, radar, evidence, method match | Parent-facing decision report |
| AI tutor | `#tutor` | Socratic chat, problem board, hint ladder | Help the child say the first step |
| Review game | `#review` | Map, challenge cards, daily challenge CTA | Validate memory, transfer, and wrong-cause repair |
| Parent center | `#parent` | Child portrait, weekly progress, parent questions | Give parents one understandable next action |

## Current Mock Data Contract

The prototype intentionally does not call a backend yet. It uses static mock data in `src/view-model.js` for:

- uploaded files and status,
- daily progress,
- report evidence,
- AI tutor dialogue,
- review map progress,
- parent summary.

Each subpage also has a compact `pageGuide` strip so the user sees the page's job and next route before scrolling. The upload page includes an intake pipeline for non-standard materials, and the report page includes confidence bands so evidence, hypotheses, and next actions do not collapse into marketing copy.

When connecting real data, keep the UI contract stable and move reusable product logic into:

- `packages/edu-core`: material classification, report generation, review/tutor planning.
- `packages/ui-contracts`: route/view-model schemas and fixtures.

## What Must Not Happen

- Do not import WXML/WXSS or miniapp pages into Web.
- Do not place Variant-generated Web code into `miniprogram`.
- Do not move Web CSS/components into `apps/app` unless the App shell explicitly wraps Web later.
- Do not bind this prototype to a specific backend before the view model contract is clean.

## Next Implementation Steps

1. Improve fidelity against the six GPT reference images.
2. Replace the remaining CSS-drawn placeholder illustrations with polished Web-owned assets.
3. Split the large `src/app.js` into route renderers and mock fixtures once the first visual direction is accepted.
4. Decide whether Vercel should route `/app`, `/learn`, or `/` to `apps/web` after approval.
5. Keep the current homepage untouched until the review path or full replacement choice is approved.

## Acceptance Gates

Minimum before shipping as official Web:

```bash
npm run web:acceptance
```

`npm run web:acceptance` covers the Web surface manifest, the root `/app` and
`/app/` preview shell asset loading paths, Web/miniapp/App boundary checks, the
direct Web screenshots, and the official `/app` screenshots.

Recommended before replacing the current official-site homepage:

```bash
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

The upload gate may still report the known miniapp AppID blocker until a real WeChat AppID replaces `touristappid`.
