# auto-push.ps1
# Syncs Cowork workspace -> git repo, pulls remote, commits, pushes to GitHub,
# deploys to Cloudflare. Run via Windows Task Scheduler on an interval.

$ErrorActionPreference = "Stop"

$cowork = "C:\Users\andy\Documents\Claude\Projects\wabashsystems"
$repo   = "C:\Users\andy\wabash-systems"

# Copy a source directory's *contents* into a destination directory,
# recursively and additively. Existing dst files are overwritten by src
# matches; dst files that don't exist in src are LEFT ALONE (no purge).
# This is critical when working across multiple machines that each have
# their own cowork folder — we never want one machine's local cowork to
# silently delete files contributed by the other.
function Sync-Dir {
    param([string]$Src, [string]$Dst)
    if (-not (Test-Path $Src)) { return }
    if (-not (Test-Path $Dst)) {
        New-Item -ItemType Directory -Path $Dst -Force | Out-Null
    }
    # Get-ChildItem $Src enumerates the *contents* of Src (not Src itself),
    # so Copy-Item drops them directly into Dst — no parent-folder doubling.
    Get-ChildItem -Path $Src -Force | Copy-Item -Destination $Dst -Recurse -Force
}

# ── Sync top-level web files from Cowork workspace to git repo ────────────────
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

# ── Sync directories (mirror contents, NOT the parent folder) ─────────────────
# Each Sync-Dir call copies the *contents* of the src dir into the dst dir.
# This avoids the Copy-Item -Recurse path-doubling bug where an existing dst
# causes the source folder to nest inside itself.
Sync-Dir -Src (Join-Path $cowork "functions") -Dst (Join-Path $repo "functions")
Sync-Dir -Src (Join-Path $cowork "docs")      -Dst (Join-Path $repo "docs")
Sync-Dir -Src (Join-Path $cowork "admin")     -Dst (Join-Path $repo "admin")

# ── Git: pull, commit, push if anything changed ───────────────────────────────
Set-Location $repo

# git emits exit codes that PowerShell's $ErrorActionPreference doesn't catch
# (those only catch PS-native errors). We have to gate every step manually.
function Invoke-Git {
    param([string[]]$Args, [string]$FailMsg)
    & git @Args
    if ($LASTEXITCODE -ne 0) {
        Write-Host "GIT FAILURE: $FailMsg (exit $LASTEXITCODE)" -ForegroundColor Red
        # Try to abort any in-flight rebase/merge so we don't leave the repo
        # stuck in a partial state that the next run will inherit.
        & git rebase --abort  2>$null
        & git merge  --abort  2>$null
        throw "Aborting deploy. Resolve git state manually before re-running."
    }
}

# Bail out of any leftover rebase/merge from a previous failed run.
if (Test-Path (Join-Path $repo ".git\rebase-merge")) { & git rebase --abort 2>$null }
if (Test-Path (Join-Path $repo ".git\rebase-apply")) { & git rebase --abort 2>$null }
if (Test-Path (Join-Path $repo ".git\MERGE_HEAD"))    { & git merge  --abort 2>$null }

# Make sure we're on main, not in a detached-HEAD state from a prior aborted run.
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
    Write-Host "Not on main (currently '$branch') — checking out main." -ForegroundColor Yellow
    Invoke-Git -Args @("checkout","main") -FailMsg "checkout main"
}

# Pull first so we don't get rejected by remote changes from another machine.
Invoke-Git -Args @("pull","--rebase","--autostash") -FailMsg "pull --rebase failed (likely merge conflict — resolve manually)"

$changes = & git status --porcelain
if (-not $changes) {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') No changes - nothing to deploy." -ForegroundColor Yellow
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Invoke-Git -Args @("add","-A")                          -FailMsg "git add"
Invoke-Git -Args @("commit","-m","Auto-sync: $timestamp") -FailMsg "git commit"
Invoke-Git -Args @("push")                              -FailMsg "git push"

# ── Cloudflare Pages: direct deploy (bypasses GitHub integration) ─────────────
# Only reached if every git step above succeeded.
& npx wrangler pages deploy . --project-name=wabash-systems --commit-dirty=true
if ($LASTEXITCODE -ne 0) {
    Write-Host "WRANGLER FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

Write-Host "$(Get-Date -Format 'HH:mm:ss') Deployed successfully." -ForegroundColor Green
