# AGENTS.md

## Working Style

- Work autonomously toward the user's final goal.
- Do not stop after partial progress unless there is a real blocker:
  - missing credentials, login, or payment
  - destructive or irreversible changes
  - external service failure
  - ambiguous product decision with high implementation cost
  - legal, privacy, or security risk
- Prefer minimal necessary changes.
- Do not refactor unrelated code.
- Read the existing implementation before editing.
- Use local search and targeted file reads before broad scans.
- Exclude heavy directories from recursive work: `node_modules`, `.next`, `.git`, `dist`, `build`, `coverage`, `vendor`, `.venv`, `venv`, `__pycache__`, `cache`, `telemetry`, `sessions`.

## Development Rules

- Preserve existing architecture and conventions unless the task requires a change.
- Keep edits scoped to the requested behavior.
- Do not add production dependencies without a clear reason.
- Do not create replacement files when an existing module should be edited.
- Do not leave placeholder text, debug logs, or dead code in user-facing paths.

## Verification

After feature work, bug fixes, refactors, or release preparation, run:

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts/verify.ps1
```

If verification fails:

1. Read the failure.
2. Fix the root cause.
3. Re-run verification.
4. Retry up to 3 rounds.
5. Stop and report if the same class of failure persists.

## Final Report

Keep the final report concise:

- changed files
- verification result
- unresolved risks or blockers
- next best step only if it materially helps

## Windows PowerShell Rule

- Do not run `.ps1` scripts directly as `.\scripts\verify.ps1`.
- Do not assume `powershell`, `powershell.exe`, `pwsh`, or `pwsh.exe` are on PATH.
- Always use:

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts/verify.ps1
```
