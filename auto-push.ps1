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
function Sync-Dir {
    param([string]$Src, [string]$Dst)
    if (-not (Test-Path $Src)) { return }
    if (-not (Test-Path $Dst)) {
        New-Item -ItemType Directory -Path $Dst -Force | Out-Null
    }
    # Get-ChildItem $Src enumerates the *contents* of Src (not Src itself),
    # so Copy-Item drops them directly into Dst - no parent-folder doubling.
    Get-ChildItem -Path $Src -Force | Copy-Item -Destination $Dst -Recurse -Force
}

# -- Sync top-level web files from Cowork workspace to git repo ----------------
$filesToSync = @(
    "index.html",
    "booking.html",
    "privacy.html",
    "_redirects",
    "favicon.svg",
    "auto-push.ps1",
    "wrangler.toml"
)

foreach ($file in $filesToSync) {
    $src = Join-Path $cowork $file
    $dst = Join-Path $repo $file
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
    }
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
Sync-Dir -Src (Join-Path $cowork "blog")          -Dst (Join-Path $repo "blog")

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

Write-Host "$(Get-Date -Format 'HH:mm:ss') Deployed successfully." -ForegroundColor Green
