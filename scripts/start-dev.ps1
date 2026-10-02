# Powershell startup script for RevOps Pro (Backend + Frontend)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir
$pidFile = Join-Path $scriptDir ".dev-pids.json"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Starting RevOps Pro Development Suite..." -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 0. Refuse to start if a previous run is still alive (avoid port clashes)
# ---------------------------------------------------------------------------
if (Test-Path $pidFile) {
    $stale = $false
    try {
        $saved = Get-Content $pidFile -Raw | ConvertFrom-Json
        foreach ($id in @($saved.backend, $saved.frontend)) {
            if ($id -and (Get-Process -Id $id -ErrorAction SilentlyContinue)) { $stale = $true }
        }
    } catch { $stale = $false }

    if ($stale) {
        Write-Host "[ERROR] A previous dev session is still running." -ForegroundColor Red
        Write-Host "        Run .\scripts\stop-dev.ps1 first, or delete $pidFile" -ForegroundColor Yellow
        exit 1
    }
    Remove-Item $pidFile -Force
}

# ---------------------------------------------------------------------------
# 1. Check Python venv
# ---------------------------------------------------------------------------
$venvPython = Join-Path $rootDir "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "[ERROR] Virtual environment not found at backend\.venv\Scripts\python.exe" -ForegroundColor Red
    Write-Host "Create it with: python -m venv backend\.venv" -ForegroundColor Yellow
    Write-Host "Then install deps: backend\.venv\Scripts\python -m pip install -r backend\requirements.txt" -ForegroundColor Yellow
    exit 1
}

# ---------------------------------------------------------------------------
# 1b. Pre-flight: refuse to start if a dev port is already taken
#
# Without this, uvicorn dies with a cryptic "[WinError 10048] ... address
# already in use" that is buried in a minimized window, while the health probe
# below happily answers from the *stale* server.  The result is a script that
# claims success but whose backend process is already dead.
# ---------------------------------------------------------------------------
function Get-PortOwner([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
    if ($conn) { return $conn.OwningProcess }
    return $null
}

$blocked = @()
foreach ($port in 8000, 3000) {
    $owner = Get-PortOwner $port
    if ($owner) {
        $ownerName = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
        $blocked += "  port $port is held by $ownerName (PID $owner)"
    }
}
if ($blocked.Count -gt 0) {
    Write-Host "[ERROR] A required port is already in use:" -ForegroundColor Red
    $blocked | ForEach-Object { Write-Host "       $_" -ForegroundColor Red }
    Write-Host "       Run .\scripts\stop-dev.ps1 to free the dev ports, then retry." -ForegroundColor Yellow
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Launch Backend (no --reload: reloader spawns a child PID that stop-dev
#    cannot reliably kill, which leaves port 8000 occupied)
# ---------------------------------------------------------------------------
$backendLog = Join-Path $rootDir "backend\dev_startup.log"
Remove-Item $backendLog -Force -ErrorAction SilentlyContinue

Write-Host "Starting Backend FastAPI server on http://127.0.0.1:8000 ..." -ForegroundColor Green
$backendProc = Start-Process -FilePath $venvPython `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory (Join-Path $rootDir "backend") `
    -RedirectStandardError $backendLog `
    -PassThru -WindowStyle Minimized

# ---------------------------------------------------------------------------
# 3. Wait for the backend to answer
#
# The port owner must be *our* PID.  Just polling /api/health is not enough:
# a stale server on 8000 would answer the probe and mask the fact that our own
# process died on startup.
# ---------------------------------------------------------------------------
Write-Host "Waiting for the backend to become healthy..." -ForegroundColor Cyan
$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
    if ($backendProc.HasExited) { break }
    $owner = Get-PortOwner 8000
    if ($owner -eq $backendProc.Id) {
        try {
            $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 2
            if ($resp.status) { $healthy = $true; break }
        } catch { }
    }
    Start-Sleep -Milliseconds 500
}

if (-not $healthy) {
    Write-Host "[ERROR] Backend failed to start." -ForegroundColor Red
    if (Test-Path $backendLog) {
        Write-Host "--- backend log (last 30 lines) ---" -ForegroundColor DarkGray
        Get-Content $backendLog -Tail 30 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    }
    if (-not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "Not starting the frontend - fix the backend first." -ForegroundColor Yellow
    exit 1
}
Write-Host "Backend is healthy (PID $($backendProc.Id))." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4. Launch Frontend
# ---------------------------------------------------------------------------
Write-Host "Starting Frontend Next.js server on http://localhost:3000 ..." -ForegroundColor Green
$frontendLog = Join-Path $rootDir "frontend\dev_startup.log"
Remove-Item $frontendLog -Force -ErrorAction SilentlyContinue

$frontendProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory (Join-Path $rootDir "frontend") `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError (Join-Path $rootDir "frontend\dev_startup.err.log") `
    -PassThru -WindowStyle Minimized

# ---------------------------------------------------------------------------
# 4b. Wait for the frontend to actually serve the login page
#
# The backend has a /api/health probe; the frontend had none, so a crashed
# `next dev` was reported as a successful start with a URL that never loads.
# ---------------------------------------------------------------------------
Write-Host "Waiting for the frontend to become ready..." -ForegroundColor Cyan
$frontendReady = $false
for ($i = 0; $i -lt 120; $i++) {
    if ($frontendProc.HasExited) { break }
    $owner = Get-PortOwner 3000
    if ($owner) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3000/login" -TimeoutSec 3 -UseBasicParsing
            if ($resp.StatusCode -eq 200) { $frontendReady = $true; break }
        } catch { }
    }
    Start-Sleep -Milliseconds 500
}

if ($frontendReady) {
    Write-Host "Frontend is ready (port 3000)." -ForegroundColor Green
} else {
    Write-Host "[ERROR] Frontend failed to become ready." -ForegroundColor Red
    foreach ($lf in @($frontendLog, (Join-Path $rootDir "frontend\dev_startup.err.log"))) {
        if (Test-Path $lf) {
            Write-Host "--- $(Split-Path -Leaf $lf) (last 30 lines) ---" -ForegroundColor DarkGray
            Get-Content $lf -Tail 30 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        }
    }
    if (-not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    if (-not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "Stopped the backend too so you do not get a half-running stack." -ForegroundColor Yellow
    exit 1
}

# Record PIDs so stop-dev.ps1 can clean up later.
@{ backend = $backendProc.Id; frontend = $frontendProc.Id } |
    ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host "`nBackend API:   http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "Swagger Docs:  http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "Frontend App:  http://localhost:3000" -ForegroundColor Yellow
Write-Host "`nStop both with .\scripts\stop-dev.ps1, or press Ctrl+C here.`n" -ForegroundColor Cyan

try {
    while ($true) {
        if ($backendProc.HasExited) {
            Write-Host "[WARNING] Backend process exited (code $($backendProc.ExitCode))." -ForegroundColor Red
            break
        }
        if ($frontendProc.HasExited) {
            Write-Host "[WARNING] Frontend process exited (code $($frontendProc.ExitCode))." -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host "`nStopping background servers..." -ForegroundColor Yellow
    if ($frontendProc -and -not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
    if ($backendProc -and -not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force }
    Write-Host "Done." -ForegroundColor Green
}
