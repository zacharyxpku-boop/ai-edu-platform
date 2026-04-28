# sync-admin-token-to-github.ps1
# 用法：右键 → "Run with PowerShell"，或在终端跑 `powershell -ExecutionPolicy Bypass -File scripts\sync-admin-token-to-github.ps1`
#
# 干啥：从 Vercel 拉 production 环境的 ADMIN_TOKEN，写进 GitHub repo secret
# 你需要做的：第一次跑会让你浏览器登 GitHub（gh auth login），点完一次以后就再不用碰

$ErrorActionPreference = "Stop"
$projectRoot = "C:\Users\86136\Desktop\claude\ai-edu-platform"
Set-Location $projectRoot

Write-Host "=== Step 1/4: 检查 vercel CLI 登录状态 ==="
$vercelUser = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "vercel CLI 没登 → 跑 vercel login 走一遍" -ForegroundColor Yellow
    vercel login
}
Write-Host "Vercel: $vercelUser" -ForegroundColor Green

Write-Host ""
Write-Host "=== Step 2/4: 检查 gh CLI 登录状态 ==="
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "gh CLI 没登 → 走浏览器 OAuth · 点同意就回来" -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web --scopes "repo,workflow"
}
$ghUser = gh api user --jq .login
Write-Host "GitHub: $ghUser" -ForegroundColor Green

Write-Host ""
Write-Host "=== Step 3/4: 从 Vercel production 拉 ADMIN_TOKEN ==="
$tmpEnv = Join-Path $env:TEMP "vercel-pulled-$([Guid]::NewGuid().ToString('N')).env"
vercel env pull $tmpEnv --environment=production --yes 2>&1 | Out-Null
if (-not (Test-Path $tmpEnv)) { throw "vercel env pull 失败 · 没拉到文件" }

$tokenLine = Select-String -Path $tmpEnv -Pattern '^ADMIN_TOKEN=' | Select-Object -First 1
if (-not $tokenLine) {
    Remove-Item $tmpEnv -Force -ErrorAction SilentlyContinue
    throw "Vercel 那边 production 环境没有 ADMIN_TOKEN · 先去 Vercel UI 加上"
}
$adminToken = $tokenLine.Line.Substring("ADMIN_TOKEN=".Length).Trim('"', "'", ' ')
Remove-Item $tmpEnv -Force
Write-Host "Token 长度: $($adminToken.Length) chars · 已拿到" -ForegroundColor Green

Write-Host ""
Write-Host "=== Step 4/4: 写进 GitHub repo secret ==="
$repoSlug = "zacharyxpku-boop/ai-edu-platform"
$adminToken | gh secret set ADMIN_TOKEN --repo $repoSlug --body -
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ADMIN_TOKEN 已写进 $repoSlug secrets" -ForegroundColor Green
} else {
    throw "gh secret set 失败"
}

Write-Host ""
Write-Host "=== 验证：列出 repo secrets ==="
gh secret list --repo $repoSlug

Write-Host ""
Write-Host "🎯 全套搞定 · parent-push-scan 整点第 5 分钟会自己跑" -ForegroundColor Cyan
Write-Host "想立刻 trigger 一下：gh workflow run parent-push-scan.yml --repo $repoSlug" -ForegroundColor Gray
