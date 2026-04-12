Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\C1\Desktop\talepet\jarvis-agent"

Set-Location $projectRoot
corepack prepare pnpm@10.6.5 --activate

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
}

corepack pnpm approve-builds
corepack pnpm install

Write-Host ""
Write-Host "Bootstrap tamamlandi." -ForegroundColor Green
Write-Host "Gelistirme icin: corepack pnpm --filter @jarvis/desktop dev"
