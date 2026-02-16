# C:\users\green\caliber-beta\tools\cleanup-nested-app.ps1
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\tools\cleanup-nested-app.ps1

$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
if ($root.ToLower() -ne "c:\users\green\caliber-beta") {
  Write-Host "ERROR: Run this from C:\users\green\caliber-beta (current: $root)" -ForegroundColor Red
  exit 1
}

$nested = Join-Path $root "app"

$nestedPkg = Join-Path $nested "package.json"
if (-not (Test-Path $nestedPkg)) {
  Write-Host "No nested app\package.json found. Nothing to remove." -ForegroundColor Yellow
  exit 0
}

# Backup potential authoritative files before deletion
$backupDir = Join-Path $root ("results\nested_app_backup_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$toBackup = @(
  "api\job-ingest\route.ts",
  "lib\job_ingest.ts",
  "app\page.tsx",
  "app\layout.tsx",
  "SPEC_ACTIVE_MILESTONE.md"
)

foreach ($rel in $toBackup) {
  $src = Join-Path $nested $rel
  if (Test-Path $src) {
    $dst = Join-Path $backupDir $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
    Copy-Item -Force $src $dst
    Write-Host "Backed up: $src -> $dst"
  }
}

Write-Host ""
Write-Host "BACKUP COMPLETE at: $backupDir" -ForegroundColor Green
Write-Host ""

# Remove nested build artifacts + dependencies
$killDirs = @(".next", "node_modules")
foreach ($d in $killDirs) {
  $p = Join-Path $nested $d
  if (Test-Path $p) {
    Write-Host "Removing directory: $p"
    Remove-Item -Recurse -Force $p
  }
}

# Remove nested root-level config files
$killFiles = @(
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next-env.d.ts",
  "next.config.ts",
  "next.config.js",
  "eslint.config.mjs",
  ".eslintrc",
  ".eslintrc.json",
  "postcss.config.mjs",
  "postcss.config.js",
  "README.md"
)

foreach ($f in $killFiles) {
  $p = Join-Path $nested $f
  if (Test-Path $p) {
    Write-Host "Removing file: $p"
    Remove-Item -Force $p
  }
}

Write-Host ""
Write-Host "DONE. Nested Next.js project artifacts removed from .\app\" -ForegroundColor Green
Write-Host "Backup saved to: $backupDir" -ForegroundColor Green