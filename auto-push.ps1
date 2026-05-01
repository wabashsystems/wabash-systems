# auto-push.ps1
# Syncs Cowork workspace -> git repo, pulls remote, commits, pushes to GitHub,
# deploys to Cloudflare. Run via Windows Task Scheduler on an interval.
#
# IMPORTANT: keep this file pure ASCII. PowerShell on Windows reads .ps1 files
# as ANSI/Windows-1252 by default, which corrupts UTF-8 multi-byte characters
# (em-dashes, smart quotes, box-drawing). Stick to plain hyphens.

$ErrorActionPreference = "Stop"

$cowork = "C:\Users\andy\Documents\Claude\Projects\wabashsystems"
$repo   = "C:\Users\andy\wabash-systems"

# Copy a source directory's *contents* into a destination directory,
# recursively and additively. Existing dst files are overwritten by src
# matches; dst files that don't exist in src are LEFT ALONE (no purge).
# This is critical when working across multiple machines that each have
# their own cowork folder - we never want one machine's local cowork to
# silently delete files contributed by the other.
#
# -Exclude: top-level child names to skip (e.g. "drafts" inside blog/).
# Used to keep unpublished content out of the deployed site without
# moving it elsewhere on disk.
function Sync-Dir {
    param([string]$Src, [string]$Dst, [string[]]$Exclude = @())
    if (-not (Test-Path $Src)) { return }
    if (-not (Test-Path $Dst)) {
        New-Item -ItemType Directory -Path $Dst -Force | Out-Null
    }
    # Get-ChildItem $Src enumerates the *contents* of Src (not Src itself),
    # so Copy-Item drops them directly into Dst - no parent-folder doubling.
    Get-ChildItem -Path $Src -Force `
        | Where-Object { $Exclude -notcontains $_.Name } `
        | Copy-Item -Destination $Dst -Recurse -Force
}

# Sync a single file between $Src (cowork) and $Dst (repo) using newer-wins
# semantics. Why this exists: a plain "Copy-Item $Src $Dst -Force" overwrites
# $Dst even when $Dst is newer - which silently regresses any edits made
# directly to the repo (e.g. a quick fix committed via git, or my edits
# pulled in from another machine via "git pull --rebase --autostash" earlier
# in this script). Newer-wins preserves whichever side was edited most
# recently. Tolerance of 1s handles NTFS/git timestamp precision drift.
#
# Bonus behavior: if $Src doesn't exist but $Dst does, scaffold $Src from
# $Dst. This auto-seeds the cowork side when a new file is added to
# $filesToSync (without that, you'd have to manually create the cowork copy
# before the first run, which is exactly the regression we're trying to
# avoid).
function Sync-File {
    param([string]$Src, [string]$Dst)

    $srcExists = Test-Path $Src
    $dstExists = Test-Path $Dst

    if (-not $srcExists -and -not $dstExists) { return }

    # Scaffold cowork from repo if cowork is missing the file entirely.
    # Lets us add to $filesToSync without manually pre-seeding cowork.
    if (-not $srcExists -and $dstExists) {
        $srcDir = Split-Path $Src -Parent
        if (-not (Test-Path $srcDir)) {
            New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
        }
        Copy-Item $Dst $Src -Force
        Write-Host "  scaffolded cowork: $(Split-Path $Src -Leaf)" -ForegroundColor Cyan
        return
    }

    # First-time copy when repo doesn't have the file yet.
    if ($srcExists -and -not $dstExists) {
        Copy-Item $Src $Dst -Force
        return
    }

    # Both sides exist — newer wins. Only overwrite $Dst if $Src is strictly
    # newer (mtime > by at least 1 second). Otherwise leave $Dst alone so
    # direct-to-repo edits or git-pulled changes don't get clobbered.
    $srcMtime = (Get-Item $Src).LastWriteTimeUtc
    $dstMtime = (Get-Item $Dst).LastWriteTimeUtc
    if ($srcMtime -gt $dstMtime.AddSeconds(1)) {
        Copy-Item $Src $Dst -Force
    }
}

# -- Sync top-level web files from Cowork workspace to git repo ----------------
$filesToSync = @(
    "index.html",
    "booking.html",
    "privacy.html",
    "_redirects",
    "_headers",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "favicon.svg",
    "auto-push.ps1",
    "wrangler.toml"
)

foreach ($file in $filesToSync) {
    Sync-File -Src (Join-Path $cowork $file) -Dst (Join-Path $repo $file)
}

# -- Sync directories (mirror contents, NOT the parent folder) -----------------
# Each Sync-Dir call copies the *contents* of the src dir into the dst dir.
# This avoids the Copy-Item -Recurse path-doubling bug where an existing dst
# causes the source folder to nest inside itself.
Sync-Dir -Src (Join-Path $cowork "functions")     -Dst (Join-Path $repo "functions")
Sync-Dir -Src (Join-Path $cowork "docs")          -Dst (Join-Path $repo "docs")
Sync-Dir -Src (Join-Path $cowork "admin")         -Dst (Join-Path $repo "admin")
Sync-Dir -Src (Join-Path $cowork "case-studies")  -Dst (Join-Path $repo "case-studies")
Sync-Dir -Src (Join-Path $cowork "lead-magnets")  -Dst (Join-Path $repo "lead-magnets")
Sync-Dir -Src (Join-Path $cowork "blog")          -Dst (Join-Path $repo "blog") -Exclude @("drafts")
Sync-Dir -Src (Join-Path $cowork "services")      -Dst (Join-Path $repo "services")
Sync-Dir -Src (Join-Path $cowork "js")            -Dst (Join-Path $repo "js")
Sync-Dir -Src (Join-Path $cowork "fonts")         -Dst (Join-Path $repo "fonts")

# -- Git: pull, commit, push if anything changed -------------------------------
Set-Location $repo

# git emits exit codes that PowerShell's $ErrorActionPreference doesn't catch
# (those only catch PS-native errors). We have to gate every step manually.
#
# NOTE: parameter is named $GitArgs, NOT $Args. $Args is a PowerShell
# automatic variable; declaring a parameter with that name does not shadow
# the automatic, and splatting @Args inside the function picks up the
# (empty) automatic instead of the passed array.
function Invoke-Git {
    param([string[]]$GitArgs, [string]$FailMsg)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "GIT FAILURE: $FailMsg (exit $LASTEXITCODE)" -ForegroundColor Red
        # Try to abort any in-flight rebase/merge so we don't leave the repo
        # stuck in a partial state that the next run will inherit.
        # *> $null fully consumes all streams (stdout, stderr, error records).
        & git rebase --abort *> $null
        & git merge  --abort *> $null
        throw "Aborting deploy. Resolve git state manually before re-running."
    }
}

# Bail out of any leftover rebase/merge from a previous failed run.
if (Test-Path (Join-Path $repo ".git\rebase-merge")) { & git rebase --abort *> $null }
if (Test-Path (Join-Path $repo ".git\rebase-apply")) { & git rebase --abort *> $null }
if (Test-Path (Join-Path $repo ".git\MERGE_HEAD"))   { & git merge  --abort *> $null }

# Make sure we're on main, not in a detached-HEAD state from a prior aborted run.
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
    Write-Host "Not on main (currently '$branch') - checking out main." -ForegroundColor Yellow
    Invoke-Git -GitArgs @("checkout","main") -FailMsg "checkout main"
}

# Pull first so we don't get rejected by remote changes from another machine.
Invoke-Git -GitArgs @("pull","--rebase","--autostash") -FailMsg "pull --rebase failed (likely merge conflict - resolve manually)"

$changes = & git status --porcelain
if (-not $changes) {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') No changes - nothing to deploy." -ForegroundColor Yellow
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Invoke-Git -GitArgs @("add","-A")                            -FailMsg "git add"
Invoke-Git -GitArgs @("commit","-m","Auto-sync: $timestamp") -FailMsg "git commit"
Invoke-Git -GitArgs @("push")                                -FailMsg "git push"

# -- Cloudflare Pages: direct deploy (bypasses GitHub integration) -------------
# --branch=main forces this to land as a Production deployment, which is
# necessary for Plaintext env vars and KV bindings (those are environment-
# scoped). Without this flag, wrangler creates a branch/preview deployment
# that can't see Production-scoped variables.
# Only reached if every git step above succeeded.
& npx wrangler pages deploy . --project-name=wabash-systems --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) {
    Write-Host "WRANGLER FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

# -- Cloudflare cache purge ----------------------------------------------------
# Pages deploys update origin but the edge cache (s-maxage from _headers) keeps
# serving stale HTML for up to an hour. Purging right after deploy makes
# changes visible immediately.
#
# Required env vars:
#   CF_PURGE_TOKEN  - Cloudflare API token scoped to "Cache Purge" only
#   CF_ZONE_ID      - Zone ID for wabashsystems.com (Cloudflare dashboard
#                     -> domain -> right sidebar -> "Zone ID")
#
# Failure here is non-fatal - the deploy already succeeded, cache will
# eventually expire on its own. We just warn.
$cfToken  = $env:CF_PURGE_TOKEN
$cfZoneId = $env:CF_ZONE_ID
if ($cfToken -and $cfZoneId) {
    try {
        $resp = Invoke-RestMethod `
            -Uri "https://api.cloudflare.com/client/v4/zones/$cfZoneId/purge_cache" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $cfToken"
                "Content-Type"  = "application/json"
            } `
            -Body (@{ purge_everything = $true } | ConvertTo-Json) `
            -ErrorAction Stop
        if ($resp.success) {
            Write-Host "[purge] Cloudflare cache purged" -ForegroundColor Green
        } else {
            $errs = ($resp.errors | ForEach-Object { $_.message }) -join "; "
            Write-Host "[purge] API returned success=false: $errs" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[purge] Cache purge failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[purge] CF_PURGE_TOKEN or CF_ZONE_ID not set - skipping cache purge" -ForegroundColor Yellow
}

Write-Host "$(Get-Date -Format 'HH:mm:ss') Deployed successfully." -ForegroundColor Green
