# download-inter.ps1
#
# One-time setup: pulls the Inter variable font from the official rsms/inter
# GitHub release and places it at cowork/fonts/Inter-Variable.woff2. Variable
# means one woff2 file covers all weights from 100-900, instead of one file
# per weight. About 265 KB total.
#
# After running, run auto-push.ps1 to deploy the font + the HTML changes
# already staged.
#
# Why self-host: Google Fonts adds DNS lookup + TLS handshake + 2 cross-origin
# hops (fonts.googleapis.com to fetch the CSS, then fonts.gstatic.com to fetch
# each woff2). Self-hosting bundles all weights in one same-origin file with
# no extra DNS/TLS - shaves 200-500 ms off first paint on cold connections.

$ErrorActionPreference = 'Stop'

$fontDir = "C:\Users\andy\Documents\Claude\Projects\wabashsystems\fonts"
if (-not (Test-Path $fontDir)) {
    New-Item -ItemType Directory -Path $fontDir | Out-Null
    Write-Host "Created $fontDir" -ForegroundColor Cyan
}

# Discover the latest Inter release zip via the GitHub API. Doing this
# dynamically (instead of hardcoding a version) means re-running the script
# later picks up the newest Inter without a code change.
Write-Host "Querying GitHub for the latest Inter release..." -ForegroundColor Cyan
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/rsms/inter/releases/latest' -UseBasicParsing
$zipAsset = $release.assets | Where-Object { $_.name -match '^Inter-[\d.]+\.zip$' } | Select-Object -First 1
if (-not $zipAsset) {
    throw "Could not find Inter-X.Y.zip in the latest release ($($release.tag_name))."
}
$sizeMb = [math]::Round($zipAsset.size / 1MB, 1)
Write-Host "  Found: $($zipAsset.name) ($sizeMb MB) - $($release.tag_name)" -ForegroundColor Gray

$tempZip = [IO.Path]::GetTempFileName() + '.zip'
Write-Host "Downloading..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $zipAsset.browser_download_url -OutFile $tempZip -UseBasicParsing

$tempExtract = Join-Path ([IO.Path]::GetTempPath()) ('inter-extract-' + [Guid]::NewGuid())
Expand-Archive -Path $tempZip -DestinationPath $tempExtract

# The variable woff2 lives at web/InterVariable.woff2 in the release zip.
$variableFont = Get-ChildItem -Path $tempExtract -Recurse -Filter 'InterVariable.woff2' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $variableFont) {
    throw "InterVariable.woff2 not found inside $($zipAsset.name). Inter's release layout may have changed."
}

$dest = Join-Path $fontDir 'Inter-Variable.woff2'
Copy-Item -Path $variableFont.FullName -Destination $dest -Force
$kb = [math]::Round((Get-Item $dest).Length / 1KB, 1)
Write-Host "Installed: $dest ($kb KB)" -ForegroundColor Green

# Cleanup temp files. Failures here are non-fatal - just clutter in %TEMP%.
try {
    Remove-Item $tempZip -Force -ErrorAction Stop
    Remove-Item $tempExtract -Recurse -Force -ErrorAction Stop
} catch {
    Write-Host "  (note: couldn't clean up some temp files - safe to ignore)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Next: run auto-push.ps1 to deploy." -ForegroundColor Cyan
