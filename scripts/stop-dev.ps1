# Stops the RevOps Pro development servers started by start-dev.ps1
$ErrorActionPreference = "SilentlyContinue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pidFile = Join-Path $scriptDir ".dev-pids.json"

function Stop-Tracked([string]$label, $procId) {
    if (-not $procId) { return }
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Stopping $label (PID $procId)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 300
    }
}

if (Test-Path $pidFile) {
    $saved = Get-Content $pidFile -Raw | ConvertFrom-Json
    Stop-Tracked "frontend" $saved.frontend
    Stop-Tracked "backend" $saved.backend
    Remove-Item $pidFile -Force
} else {
    Write-Host "No PID file found - falling back to port lookup." -ForegroundColor DarkGray
}

# Fallback: free the dev ports from anything else still holding them.
foreach ($port in 3000, 8000) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        $ownerPid = $conn.OwningProcess
        # Never kill PID 0/4 (System) or our own shell.
        if ($ownerPid -and $ownerPid -gt 4 -and $ownerPid -ne $PID) {
            $procName = (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue).ProcessName
            if ($procName -match '^(node|python|pythonw)$') {
                Write-Host "Freeing port $port held by $procName (PID $ownerPid)..." -ForegroundColor Yellow
                Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            } else {
                Write-Host "Port $port is held by '$procName' (PID $ownerPid) - left untouched." -ForegroundColor DarkGray
            }
        }
    }
}

Write-Host "Dev servers stopped." -ForegroundColor Green
