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
  node --check miniprogram/utils/review-cards.js
  node --check miniprogram/pages/review/review.js
  node --check api/mini/content-engine.js
  node --check api/mini/sync.js
  node --check scripts/test-review-engine.cjs
}

Invoke-Step "Miniapp Fullcheck" {
  npm.cmd run miniapp:fullcheck
}

Invoke-Step "Test Suite" {
  npm.cmd test
}

Invoke-Step "Security Scan" {
  Assert-NoSecrets
  Write-Host "No secret-like tokens found." -ForegroundColor Green
}

Invoke-Step "Upload Gate" {
  Invoke-OptionalUploadGate
}

Invoke-Step "Diff Stat" {
  git diff --stat
}

Write-Host ""
Write-Host "Verification completed." -ForegroundColor Green
