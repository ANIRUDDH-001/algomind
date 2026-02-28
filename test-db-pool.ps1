$supabaseUrl = "https://algomind-supabase.aniruddhvijay2k7.workers.dev"
$anonKey = "sb_publishable_atnV9QLMxPcZKPNgSiL29A_wipjq2pa"

$jobs = @()

Write-Host "Starting 50 concurrent DB requests..."
$startAll = Get-Date

1..50 | ForEach-Object {
    $jobs += Start-Job -ScriptBlock {
        param($url, $key)
        $start = Get-Date
        try {
            $r = Invoke-WebRequest -Uri "$url/rest/v1/global_feature_flags?select=key&limit=1" `
                -Headers @{"apikey"=$key; "Authorization"="Bearer $key"} `
                -UseBasicParsing -TimeoutSec 15
            $ms = [int]((Get-Date) - $start).TotalMilliseconds
            return @{status=$r.StatusCode; ms=$ms; ok=$true}
        } catch {
            $ms = [int]((Get-Date) - $start).TotalMilliseconds
            return @{status=0; ms=$ms; ok=$false; err=$_.Exception.Message}
        }
    } -ArgumentList $supabaseUrl, $anonKey
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$totalMs = [int]((Get-Date) - $startAll).TotalMilliseconds
$ok = ($results | Where-Object { $_.ok }).Count
$fail = ($results | Where-Object { -not $_.ok }).Count
$avgMs = [int](($results | Measure-Object -Property ms -Average).Average)
$p95 = ($results | Sort-Object ms | Select-Object -Skip 47 | Select-Object -First 1).ms

Write-Host "`n=== DB Pool Stress Test Results ==="
Write-Host "Total time: ${totalMs}ms"
Write-Host "Success: $ok / 50"
Write-Host "Failures: $fail / 50"
Write-Host "Avg latency: ${avgMs}ms"
Write-Host "P95 latency: ${p95}ms"
$results | Where-Object { -not $_.ok } | ForEach-Object { Write-Host "ERROR: $($_.err)" }
