# get-genshin-url.ps1
# Reads the Genshin Impact game log and copies your wish history URL to the clipboard.
#
# HOW TO USE
#   1. Open Genshin Impact and navigate to Wish → History. Let it fully load.
#   2. Open PowerShell and run:
#        powershell -ExecutionPolicy Bypass -File ".\scripts\get-genshin-url.ps1"
#   3. Paste the URL into the tracker and click Import.
#
# The URL contains a temporary authkey that expires in ~24 hours.
# Do not share it publicly.

$logPaths = @(
    "$env:APPDATA\..\LocalLow\miHoYo\Genshin Impact\output_log.txt",  # Global
    "$env:APPDATA\..\LocalLow\miHoYo\原神\output_log.txt"              # CN
)

$urlPattern = 'OnGetWebViewPageFinish:(https://[^\s\r\n]+getGachaLog[^\s\r\n]+)'
$url        = $null
$logRead    = $false

foreach ($rawPath in $logPaths) {
    $path = [System.IO.Path]::GetFullPath($rawPath)
    if (-not (Test-Path $path)) { continue }

    Write-Host "Found log: $path" -ForegroundColor Cyan

    try {
        # Open with shared read so we can read while the game has the file open
        $fs     = [System.IO.File]::Open($path, [System.IO.FileMode]::Open,
                                         [System.IO.FileAccess]::Read,
                                         [System.IO.FileShare]::ReadWrite)
        $reader = [System.IO.StreamReader]::new($fs)
        $content = $reader.ReadToEnd()
        $reader.Close(); $fs.Close()
        $logRead = $true
    } catch {
        Write-Warning "Could not read log file: $_"
        continue
    }

    $matches = [regex]::Matches($content, $urlPattern)
    if ($matches.Count -gt 0) {
        # Last match = most recent session
        $url = $matches[$matches.Count - 1].Groups[1].Value
        break
    }
}

Write-Host ""

if (-not $logRead) {
    Write-Host "ERROR: Game log not found." -ForegroundColor Red
    Write-Host "Checked:" -ForegroundColor Yellow
    $logPaths | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Make sure Genshin Impact is installed and you have opened" -ForegroundColor Yellow
    Write-Host "Wish -> History at least once this session." -ForegroundColor Yellow
    exit 1
}

if (-not $url) {
    Write-Host "ERROR: No wish history URL found in the log." -ForegroundColor Red
    Write-Host ""
    Write-Host "Steps to fix:" -ForegroundColor Yellow
    Write-Host "  1. Open Genshin Impact" -ForegroundColor Yellow
    Write-Host "  2. Go to Wish -> History and wait for it to fully load" -ForegroundColor Yellow
    Write-Host "  3. Run this script again immediately after" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The authkey in the URL expires after ~24 hours, so you may need" -ForegroundColor Yellow
    Write-Host "to open the history screen again to generate a fresh one." -ForegroundColor Yellow
    exit 1
}

Write-Host "Wish history URL found!" -ForegroundColor Green
Write-Host ""
Write-Host $url
Write-Host ""
Set-Clipboard $url
Write-Host "Copied to clipboard." -ForegroundColor Green
Write-Host "Paste it into the tracker and click 'Import new pulls'." -ForegroundColor Green
