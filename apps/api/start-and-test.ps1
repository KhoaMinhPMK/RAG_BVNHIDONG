# Start backend server and test it
Write-Host "Starting backend server..." -ForegroundColor Cyan

# Change to api directory
Set-Location E:\project\webrag\apps\api

# Start server in background
$job = Start-Job -ScriptBlock {
    Set-Location E:\project\webrag\apps\api
    yarn dev
}

Write-Host "Waiting 5 seconds for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test health endpoint
Write-Host "`nTesting health endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get
    Write-Host "✅ Server is running!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "❌ Server not responding: $_" -ForegroundColor Red
    Write-Host "`nJob output:" -ForegroundColor Yellow
    Receive-Job -Job $job
}

# Test API root
Write-Host "`nTesting API root..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api" -Method Get
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "❌ API root not responding: $_" -ForegroundColor Red
}

Write-Host "`nServer job ID: $($job.Id)" -ForegroundColor Yellow
Write-Host "To stop: Stop-Job -Id $($job.Id); Remove-Job -Id $($job.Id)" -ForegroundColor Yellow
