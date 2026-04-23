# auto-push.ps1
# Syncs Cowork workspace -> git repo, commits, pushes to GitHub, deploys to Cloudflare.
# Run via Windows Task Scheduler on an interval.

$ErrorActionPreference = "Stop"

$cowork = "C:\Users\andy\Documents\Claude\Projects\wabashsystems"
$repo   = "C:\Users\andy\wabash-systems"

# ── Sync web files from Cowork workspace to git repo ──────────────────────────
$filesToSync = @(
    "index.html",
    "booking.html",
    "_redirects",
    "favicon.svg",
    "auto-push.ps1"
)

foreach ($file in $filesToSync) {
    $src = Join-Path $cowork $file
    $dst = Join-Path $repo $file
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
    }
}

# Sync functions directory (contact form API)
$funcSrc = Join-Path $cowork "functions"
$funcDst = Join-Path $repo "functions"
if (Test-Path $funcSrc) {
    Copy-Item $funcSrc $funcDst -Recurse -Force
}

# ── Git: commit and push if anything changed ──────────────────────────────────
Set-Location $repo

$changes = git status --porcelain
if (-not $changes) {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') No changes — nothing to deploy." -ForegroundColor Yellow
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git add -A
git commit -m "Auto-sync: $timestamp"
git push

# ── Cloudflare Pages: direct deploy (bypasses GitHub integration) ──────────────
npx wrangler pages deploy . --project-name=wabash-systems --commit-dirty=true

Write-Host "$(Get-Date -Format 'HH:mm:ss') Deployed successfully." -ForegroundColor Green
