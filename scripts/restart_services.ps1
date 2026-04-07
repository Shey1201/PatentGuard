# Stop any existing processes
Get-NetTCPConnection -LocalPort 8000,3000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Start backend
$env:PYTHONPATH = "D:\Project\PatentGuard"
$backendJob = Start-Job -ScriptBlock {
    Set-Location "D:\Project\PatentGuard\backend"
    $env:PYTHONPATH = "D:\Project\PatentGuard"
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
}

Start-Sleep -Seconds 5

# Start frontend
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "D:\Project\PatentGuard\frontend"
    npm run dev
}

Write-Host "Backend job started"
Write-Host "Frontend job started"
