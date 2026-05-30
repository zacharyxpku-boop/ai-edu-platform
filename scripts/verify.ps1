$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "========== $Name ==========" -ForegroundColor Cyan
  & $Action
}

function Invoke-Native {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Assert-NoSecrets {
  $files = Get-ChildItem -Recurse -File miniprogram, scripts | Where-Object {
    $_.Extension -in '.js', '.cjs', '.mjs', '.ts', '.tsx', '.ps1'
  }

  $hits = @()
  $regexes = @(
    'sk-[A-Za-z0-9]{20,}',
    '(?i)(OPENAI|ANTHROPIC|DEEPSEEK|DASHSCOPE|QWEN)[A-Z0-9_]*\s*[:=]\s*["''][A-Za-z0-9_\-]{24,}["'']',
    '(?i)(api[_-]?key|token|secret)\s*[:=]\s*["''][A-Za-z0-9_\-]{24,}["'']'
  )
  foreach ($regex in $regexes) {
    $match = $files | Select-String -Pattern $regex
    if ($match) {
      $hits += $match
    }
  }

  if ($hits.Count -gt 0) {
    $hits | Select-Object -First 20 | ForEach-Object {
      Write-Host "SECRET? $($_.Path):$($_.LineNumber) $($_.Line.Trim())" -ForegroundColor Red
    }
    throw "Secret scan failed."
  }
}

function Invoke-OptionalUploadGate {
  $result = & node scripts/miniapp-launch-assistant.cjs --upload-ready 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -eq 0) {
    Write-Host "Upload-ready gate: PASS" -ForegroundColor Green
    return
  }

  Write-Host "Upload-ready gate: BLOCKED (non-fatal in local verification)" -ForegroundColor Yellow
  $result | ForEach-Object { Write-Host $_ }
}

Write-Host "Repository verification started" -ForegroundColor Green

Invoke-Step "Syntax" {
  Invoke-Native "node" @("--check", "miniprogram/utils/review-cards.js")
  Invoke-Native "node" @("--check", "miniprogram/utils/openmaic-inspired-plan.js")
  Invoke-Native "node" @("--check", "miniprogram/pages/review/review.js")
  Invoke-Native "node" @("--check", "scripts/test-openmaic-inspired-plan.cjs")
  Invoke-Native "node" @("--check", "api/mini/content-engine.js")
  Invoke-Native "node" @("--check", "api/mini/sync.js")
  Invoke-Native "node" @("--check", "scripts/test-review-engine.cjs")
  Invoke-Native "node" @("--check", "scripts/check-miniapp-wxml-compiler.cjs")
  Invoke-Native "node" @("--check", "scripts/check-product-boundaries.cjs")
  Invoke-Native "node" @("--check", "apps/web/scripts/check-web-surface.cjs")
  Invoke-Native "node" @("scripts/check-miniapp-wxml-compiler.cjs")
  Invoke-Native "node" @("scripts/check-product-boundaries.cjs")
  Invoke-Native "node" @("apps/web/scripts/check-web-surface.cjs")
}

Invoke-Step "Miniapp Fullcheck" {
  Invoke-Native "npm.cmd" @("run", "miniapp:fullcheck")
}

Invoke-Step "Miniapp Standalone Sync Dry Run" {
  Invoke-Native "node" @("--check", "scripts/sync-miniapp-repo.cjs")
  Invoke-Native "node" @("scripts/sync-miniapp-repo.cjs", "--dry-run")
}

Invoke-Step "Miniapp Depth Audit" {
  Invoke-Native "node" @("--check", "scripts/miniapp-depth-audit.cjs")
  Invoke-Native "node" @("scripts/miniapp-depth-audit.cjs")
}

Invoke-Step "Test Suite" {
  Invoke-Native "npm.cmd" @("test")
}

Invoke-Step "Security Scan" {
  Assert-NoSecrets
  Write-Host "No secret-like tokens found." -ForegroundColor Green
}

Invoke-Step "Upload Gate" {
  Invoke-OptionalUploadGate
}

Invoke-Step "Diff Stat" {
  git -c safe.directory="$((Resolve-Path -LiteralPath .).Path.Replace('\', '/'))" diff --stat
}

Write-Host ""
Write-Host "Verification completed." -ForegroundColor Green
