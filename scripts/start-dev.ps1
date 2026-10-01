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
# 2. Launch Backend (no --reload: reloader spawns a child PID that stop-dev
#    cannot reliably kill, which leaves port 8000 occupied)
# ---------------------------------------------------------------------------
Write-Host "Starting Backend FastAPI server on http://127.0.0.1:8000 ..." -ForegroundColor Green
$backendProc = Start-Process -FilePath $venvPython `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory (Join-Path $rootDir "backend") `
    -PassThru -WindowStyle Minimized

# ---------------------------------------------------------------------------
# 3. Wait for the API to answer before starting the frontend
# ---------------------------------------------------------------------------
Write-Host "Waiting for the backend to become healthy..." -ForegroundColor Cyan
$healthy = $false
for ($i = 0; $i -lt 40; $i++) {
    if ($backendProc.HasExited) { break }
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 2
        if ($resp.status) { $healthy = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
}
if ($healthy) {
    Write-Host "Backend is healthy." -ForegroundColor Green
} else {
    Write-Host "[WARNING] Backend did not report healthy within 20s." -ForegroundColor Yellow
    Write-Host "          Continuing anyway - check http://127.0.0.1:8000/docs" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 4. Launch Frontend
# ---------------------------------------------------------------------------
Write-Host "Starting Frontend Next.js server on http://localhost:3000 ..." -ForegroundColor Green
$frontendProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory (Join-Path $rootDir "frontend") `
    -PassThru -WindowStyle Minimized

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
