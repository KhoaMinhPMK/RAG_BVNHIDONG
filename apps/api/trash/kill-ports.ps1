# Kill all Node.js processes on backend ports
Write-Host "Finding Node.js processes on ports 3000, 3001, 3005..." -ForegroundColor Cyan

$ports = @(3000, 3001, 3005)

foreach ($port in $ports) {
    Write-Host "`nChecking port $port..." -ForegroundColor Yellow

    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

            if ($process) {
                Write-Host "  Found: $($process.ProcessName) (PID: $processId)" -ForegroundColor Red
                Write-Host "  Killing process..." -ForegroundColor Red
                Stop-Process -Id $processId -Force
                Write-Host "  ✓ Killed PID $processId" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  Port $port is free" -ForegroundColor Green
    }
}

Write-Host "`n✓ Done! All ports cleared." -ForegroundColor Green
Write-Host "You can now run: yarn dev" -ForegroundColor Cyan
