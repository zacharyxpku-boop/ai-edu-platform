# Official Web Deploy Checklist

Use this checklist when publishing the Web prototype to `https://yuandianzhixue.com/app`.

## Current Boundary

- Web implementation: `apps/web/`
- Official `/app` shell: `app/index.html`
- Web-owned assets: `apps/web/assets/brand/`
- Shared contracts: `packages/ui-contracts/`
- Future shared business logic: `packages/edu-core/`
- Do not deploy from or copy UI code into `miniprogram/`.

## Pre-Deploy

Run from the source repo:

```bash
npm.cmd run web:acceptance
npm.cmd run web:prepare:deploy
```

`web:prepare:deploy` prints a clean temporary bundle path like:

```text
C:\Users\86136\AppData\Local\Temp\yuandian-web-official-...
```

Switch into that bundle and run:

```bash
npm.cmd run web:acceptance
npm.cmd run web:deploy:check
```

If `web:deploy:check` fails only on Vercel auth, log in:

```bash
npx.cmd vercel login
```

or set `VERCEL_TOKEN` for this shell/session.

## Deploy

From the clean bundle:

```bash
npm.cmd run web:deploy:prod
```

The deploy script runs:

1. `web:deploy:check`
2. `web:acceptance`
3. `npx.cmd vercel deploy --prod`
4. `web:live:check` against the Vercel deployment URL when available
5. `web:live:check` against `https://yuandianzhixue.com`

## Live Acceptance

The official domain must pass:

```bash
npm.cmd run web:live:check
```

This verifies:

- `/` homepage includes a visible `/app` entry
- `/app` shell returns 200
- `/apps/web/src/styles.css` loads
- `/apps/web/src/app.js` loads
- `/apps/web/src/routes.js` loads
- `/apps/web/src/view-model.js` loads
- brand image assets load

Until that passes, the official Web app is not live.
