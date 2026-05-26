# Web Goal Completion Audit

Date: 2026-05-26

This audit maps the active Web goal to current implementation evidence. It separates code-complete items from the remaining external production blocker.

## Goal Requirements

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Rebuild the official website around the miniapp product capability and layout | `apps/web/index.html`, `apps/web/src/app.js`, `apps/web/src/styles.css`, `apps/web/src/view-model.js` implement the Web product surface | Code-ready for `/app`; root homepage not fully replaced by design decision |
| Use the six GPT-generated screens as the Web reference | `apps/web/design-references/notes/gpt-six-screen-reference.md` and `apps/web/design-references/REFERENCE-ASSET-INDEX.md` preserve the standard | Done as notes; raw GPT images still need to be exported locally if available |
| Keep Web, miniapp, and future App surfaces from contaminating each other | `apps/web/surface-manifest.json`, `docs/PRODUCT-SURFACE-BOUNDARIES.md`, `scripts/check-product-boundaries.cjs` | Done and checked by `npm.cmd run check:boundaries` |
| Build a usable Web prototype in `apps/web` | Six hash routes: `#home`, `#upload`, `#report`, `#tutor`, `#review`, `#parent` | Done |
| Match requested page frame: left navigation, top search/student/family state, main content, right progress rail | `apps/web/index.html` and `app/index.html` shells, plus Web screenshots in `docs/web-app-preview/` | Done for local and `/app` preview shell |
| Use static mock data first; do not connect real backend | `apps/web/src/view-model.js` contains Web demo state, entries, page guides, material pipeline, and confidence bands | Done |
| Make pages clickable and naturally routed | `apps/web/src/app.js` handles hash routing, search routing, action buttons, toast, print, share, and next-route guide buttons | Done |
| Capture screenshots and compare/iterate | `npm.cmd run web:acceptance` generates 24 screenshots across direct Web and official `/app` shell | Done locally |
| Keep complex visuals Web-owned | Radar, review map, report preview, mascot, and brand images are implemented under `apps/web` | Done for prototype; polish can continue |
| Preserve existing useful assets such as QR or homepage material where useful | Root `index.html` is preserved and now includes `/app` entry points; existing assets remain untouched | Done |
| Make the official website expose the Web app | `vercel.json` rewrites `/app` and `/app/` to `app/index.html`; root `index.html` links to `/app` | Code-ready |
| Verify live official domain | `npm.cmd run web:live:check` checks `/`, `/app`, Web modules, and assets | Blocked until Vercel deploy succeeds |

## Current Green Gates

These gates have passed in the source repo:

```bash
npm.cmd run web:check
npm.cmd run check:boundaries
npm.cmd run web:acceptance
```

A clean deploy bundle has also passed `npm.cmd run web:acceptance` after `npm.cmd run web:prepare:deploy`.

## Remaining Blocker

Production deploy is blocked by missing Vercel authentication:

```text
VERCEL_TOKEN=missing
~/.vercel/auth.json=missing
web:deploy:check -> Vercel auth missing
```

The live domain still fails because it has not received the Web deployment:

```bash
npm.cmd run web:live:check
```

Expected current failure before deploy:

- `/` homepage lacks the new `/app` entry on production
- `/app` returns 404
- `/apps/web/src/styles.css` returns 404
- `/apps/web/src/app.js` returns 404
- `/apps/web/src/routes.js` returns 404
- `/apps/web/src/view-model.js` returns 404
- Web-owned brand images return 404

## Shortest Path To Finish

1. Authenticate Vercel on this machine:

```bash
npx.cmd vercel login
```

or provide `VERCEL_TOKEN`.

2. Generate a fresh clean bundle:

```bash
npm.cmd run web:prepare:deploy
```

3. In the printed bundle directory:

```bash
npm.cmd run web:deploy:prod
```

4. Goal can be marked complete only after:

```bash
npm.cmd run web:live:check
```

passes against `https://yuandianzhixue.com`.
