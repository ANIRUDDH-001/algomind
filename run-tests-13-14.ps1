Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        Set-Item -Path "env:\$name" -Value $value
    }
}
node test-groq.js | Out-File -FilePath test-groq.log -Encoding UTF8
node test-groq.js

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportDir = "test-report-$timestamp"
New-Item -ItemType Directory -Path $reportDir | Out-Null

Get-ChildItem -Filter "*.log" | Copy-Item -Destination $reportDir
Get-ChildItem -Filter "*.csv" | Copy-Item -Destination $reportDir

@{
    date = (Get-Date).ToString()
    os = (Get-CimInstance Win32_OperatingSystem).Caption
    ram_gb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB, 1)
    cpu = (Get-CimInstance Win32_Processor).Name
    node_version = (node --version)
    npm_version = (npm --version)
} | ConvertTo-Json | Out-File "$reportDir/system-info.json" -Encoding UTF8

Compress-Archive -Path $reportDir -DestinationPath "$reportDir.zip"
Write-Host "All results saved to $reportDir.zip"
