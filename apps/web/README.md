# Web Surface

`apps/web` is the website / H5 / PWA product surface.

It should reproduce the miniapp's product loop on the official website, but it must not import or paste miniapp page code.

## Entries

The first web version should expose six clear entries:

- `/` 首页总览
- `/upload` 上传资料
- `/report` 个性化报告
- `/tutor` AI私教
- `/review` 复习游戏
- `/parent` 家长中心

The authoritative entry list is `surface-manifest.json`.

## Allowed

- Web routes, Web components, Web CSS, responsive layout, browser interactions.
- Website-specific report preview and PDF export UI.
- Calls into `packages/edu-core` for platform-neutral education logic.
- Calls into `packages/ui-contracts` for shared view-model contracts and fixtures.
- Web-only design references under `design-references/`.

## Forbidden

- Directly importing `miniprogram/**/*.wxml`, `miniprogram/**/*.wxss`, or `miniprogram/pages/**`.
- Moving Variant or GPT-generated web code into `miniprogram/`.
- Writing `wx`-dependent logic in Web code.
- Letting `apps/app` depend on Web implementation details unless the App shell intentionally wraps the Web release later.

## Design Workflow

Send either screenshots or Variant code.

- Screenshots define the target look and UX.
- Variant code can be used as a stronger layout reference.
- Production implementation still happens inside `apps/web`.

Run:

```bash
npm run web:check
npm run check:boundaries
```
