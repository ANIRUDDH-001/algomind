Write-Host "Starting Next.js..."
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -PassThru -NoNewWindow
Start-Sleep -Seconds 20

Write-Host "Sending 100 requests..."
1..100 | ForEach-Object {
    try { Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5 | Out-Null } catch {}
}

Write-Host "Capturing Memory..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Select-Object Name, Id, CPU, WorkingSet, VirtualMemorySize | ConvertTo-Json | Out-File memory-results.json -Encoding UTF8

Write-Host "Killing Node..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
