$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendPath = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"

# Stop any existing processes
Get-NetTCPConnection -LocalPort 8000,3000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Start backend
$env:PYTHONPATH = $ProjectRoot
$backendJob = Start-Job -ScriptBlock {
    param($BackendPath, $ProjectRoot)
    Set-Location $BackendPath
    $env:PYTHONPATH = $ProjectRoot
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
} -ArgumentList $BackendPath, $ProjectRoot

Start-Sleep -Seconds 5

# Start frontend
$frontendJob = Start-Job -ScriptBlock {
    param($FrontendPath)
    Set-Location $FrontendPath
    npm run dev
} -ArgumentList $FrontendPath

Write-Host "Backend job started: $($backendJob.Id)"
Write-Host "Frontend job started: $($frontendJob.Id)"
