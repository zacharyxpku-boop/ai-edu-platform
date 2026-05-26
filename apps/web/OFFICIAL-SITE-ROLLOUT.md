# Official Site Rollout Boundary

This file defines how the Web app should move toward `yuandianzhixue.com`
without mixing the Web, miniapp, and future App surfaces.

## Current Decision

Keep the rebuilt product Web app in `apps/web` until visual acceptance is
clear. Do not replace the current root homepage yet.

The repo now includes a thin official-site preview shell at `app/index.html`.
It does not own product logic. It loads the Web app CSS and JavaScript from
`apps/web` and sets the Web asset base to `apps/web/assets/brand`.

Recommended rollout order:

1. Use `npm run web:dev` for local review at `http://127.0.0.1:3001`.
2. Use `npm run web:capture` to generate visual evidence in
   `docs/web-app-preview/*-current.png`.
3. Use `npm run web:dev:site` to review the official-site preview path at
   `http://127.0.0.1:3002/app/`.
4. Use `npm run web:capture:site` to capture the official `/app` shell as
   `docs/web-app-preview/site-*-current.png`.
5. After acceptance, expose the Web app on the official domain as `/app`.
   A later `/learn` alias can be added if needed.
6. Only after the review path is accepted should `/` be replaced or redirected.

## Surface Boundaries

- `apps/web` owns Web routes, Web assets, and Web styling.
- `miniprogram` remains the WeChat miniapp production surface.
- `apps/app` is reserved for a future lightweight App shell.
- Shared logic must move into `packages/edu-core` or `packages/ui-contracts`,
  not into a specific surface.

## What Can Be Reused

The Web app can reuse:

- product language and capability contracts from the miniapp,
- copied Web-owned brand assets under `apps/web/assets`,
- platform-neutral view models from `packages/ui-contracts`,
- platform-neutral education logic from `packages/edu-core`.

The Web app must not reuse:

- WXML or WXSS,
- miniapp page files,
- App shell code,
- platform-specific globals such as `wx`, DOM APIs inside shared packages, or
  native App APIs inside shared packages.

## Vercel Routing Options

Option A: preview path first.

- Keep the current official homepage.
- Route `/app` to the Web app after visual acceptance.
- Best when the current website still needs to preserve existing SEO pages.

Option B: full replacement.

- Replace `/` with the Web app after screenshots and product flow are accepted.
- Keep old high-value pages as secondary routes or redirects.
- Best when the official site should become the product experience directly.

Do not configure either option until the visual reference pass is accepted and
the following gates are green:

```bash
npm run web:check
npm run check:boundaries
npm run web:capture
npm run web:capture:site
```

Or run the combined gate:

```bash
npm run web:acceptance
```

Before running a production deploy, check that the Vercel project binding,
`/app` routing, deploy files, and local Vercel credentials are present:

```bash
npm run web:deploy:check
```

If this fails only on Vercel auth, the Web bundle can still be prepared and
accepted locally, but production deploy must wait until `npx.cmd vercel login`
has been completed or `VERCEL_TOKEN` is available.

After production deploy, verify that the public `/app` path and its Web-owned
assets are really live:

```bash
npm run web:live:check
```

The production deploy command is intentionally guarded:

```bash
npm run web:deploy:prod
```

It runs deploy readiness, local Web acceptance, `vercel deploy --prod`, then
checks the returned Vercel URL and the official domain. If Vercel auth is not
available, it stops before deploy.

For a preview deployment or alternate domain, pass the origin:

```bash
npm run web:live:check -- https://your-preview-url.vercel.app
```

Before replacing `/`, also run:

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```
