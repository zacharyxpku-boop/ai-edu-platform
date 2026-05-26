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
