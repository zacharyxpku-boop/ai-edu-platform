# AI Context

Last updated: 2026-05-13

## Purpose

`ai-edu-platform` is the Yuandian Zhixue miniapp-first learning product. The current product promise is: help a family decide what to do first tonight, why it matters, what the child should do next, and what the parent should review.

## Current Focus

- Keep the engineering system stable before adding features.
- Confirm tests and `scripts/verify.ps1` still pass after takeover.
- Preserve the RC2 first-screen/viewModel direction.
- Do not expand product scope until the current miniapp loop is verified.

## Current P0

- Run the existing verification entrypoint before claiming the repo is stable.
- Do not upload or prepare a WeChat review build until a real AppID replaces `touristappid`.
- Keep profile/review/tools first screens routed through viewModel outputs.
- Avoid reviving old dashboard/report/game modules on first screens.

## Repo Boundaries

- Git root: `C:\Users\86136\Desktop\claude\ai-edu-platform`
- Current branch observed during takeover: `main`
- This repo has many existing dirty files. Do not revert, reset, clean, or stage broad changes unless the user explicitly asks.

## Read Order

For most tasks, read only:

1. `AGENTS.md`
2. `docs/AI_CONTEXT.md`
3. `docs/TODO.md`
4. `docs/CHANGELOG_AI.md`
5. Files found with `rg` for the current task

Only read `docs/DECISIONS.md`, `docs/rc2-architecture-audit.md`, or long product docs when the task is architectural.

## Search First

Before opening large files, locate the relevant code with targeted search:

```powershell
rg "keyword" -n --glob "!node_modules" --glob "!.git" --glob "!.next"
```

Prefer reading narrow snippets around matches over loading whole files.

## Verification

Use the repo entrypoint:

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

If full verification is too heavy, run the narrowest matching npm script from `package.json`, then report that full verification was not run.

## Cost Rules

- Do not reread long docs during routine coding.
- Keep work in small batches.
- Summarize progress into this file, `docs/TODO.md`, or `docs/CHANGELOG_AI.md` instead of relying on chat history.
- Prefer focused tests before full verification.

## Hard Stops

- No `git reset --hard`.
- No `git clean -fd`.
- No recursive delete commands.
- No dependency install unless the user asks.
- No API key printing, setting, or migration.
