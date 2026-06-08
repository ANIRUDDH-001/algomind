# Phase 7.9 - run-ab.ps1
# Apache Bench smoke test harness (Windows PowerShell)
# 7 numeric assertions
# CRITICAL: Smoke-only validation. Do NOT use for gating decisions. Use k6 results for promotion.

param (
    [string]$BaseUrl = "http://localhost:3000",
    [int]$Concurrency = 5,
    [int]$Requests = 100,
    [string]$OutputDir = "."
)

# Assertion 1: Validate Apache Bench is installed
try {
    $abVersion = ab -h 2>&1 | Select-String "ApacheBench" | Select-Object -First 1
    if (-not $abVersion) {
        Write-Error "Apache Bench (ab) not found. Install httpd or apache2-utils."
        exit 1
    }
} catch {
    Write-Error "Apache Bench (ab) not available: $_"
    exit 1
}

# Assertion 2: Smoke-only disclaimer
$disclaimer = @"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  APACHE BENCH SMOKE TEST - DO NOT USE FOR GATING DECISIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This test validates endpoint availability only (smoke test).
Results are NOT used for performance promotion decisions.
Use k6 load test results for gating decisions.

Configuration:
  Base URL: $BaseUrl
  Concurrency: $Concurrency
  Requests: $Requests
  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@

Write-Host $disclaimer -ForegroundColor Yellow

# Initialize results summary (Assertion 3)
$summaryResults = @{
    test_type = "apache-bench-smoke"
    timestamp = Get-Date -Format "o"
    base_url = $BaseUrl
    concurrency = $Concurrency
    requests = $Requests
    disclaimer = "Smoke-only. Do NOT use for gating. k6 is gating authority."
    endpoints = @()
}

# Read endpoints from endpoints.txt (Assertion 4)
$endpointFile = Join-Path (Split-Path $PSCommandPath) "endpoints.txt"
if (-not (Test-Path $endpointFile)) {
    Write-Error "endpoints.txt not found at $endpointFile"
    exit 1
}

$endpoints = @()
$csv = Get-Content $endpointFile | ConvertFrom-Csv
foreach ($line in $csv) {
    $endpoints += @{
        path = $line.endpoint_path
        method = $line.method
        expected_status = [int]::Parse($line.expected_status)
        description = $line.description
    }
}

# Assertion 5: Execute AB for each endpoint
$failCount = 0
foreach ($endpoint in $endpoints) {
    $url = "${BaseUrl}$($endpoint.path)"
    Write-Host "Testing $($endpoint.method) $url..." -ForegroundColor Cyan
    
    # Run Apache Bench (-c concurrency, -n total requests)
    $abOutput = & ab -c $Concurrency -n $Requests -q "$url" 2>&1
    
    # Parse results
    $completedRequests = ($abOutput | Select-String "Requests per second" | 
                         Select-Object -First 1 -ExpandProperty Line) -replace "[^0-9.]", ""
    $failedRequests = ($abOutput | Select-String "Failed requests" | 
                      Select-Object -First 1 -ExpandProperty Line) -replace "[^0-9]", ""
    $duration = ($abOutput | Select-String "Time taken for tests:" | 
                 Select-Object -First 1 -ExpandProperty Line) -split "\s+" | Select-Object -Index 4
    
    $result = @{
        endpoint = $endpoint.path
        method = $endpoint.method
        concurrency = $Concurrency
        requests = $Requests
        failed_requests = if ([string]::IsNullOrEmpty($failedRequests)) { 0 } else { $failedRequests }
        fail_pct = if ($failedRequests -eq 0) { 0 } else { [math]::Round(([int]$failedRequests / $Requests * 100), 2) }
        duration_seconds = if ([string]::IsNullOrEmpty($duration)) { 0 } else { [double]$duration }
    }
    
    # Assertion 6: Check endpoint responds
    if ($result.failed_requests -gt 0) {
        Write-Host "  ⚠️  Some requests failed: $($result.failed_requests)/$Requests" -ForegroundColor Yellow
        $failCount++
    } else {
        Write-Host "  ✓ All requests succeeded (0% failure)" -ForegroundColor Green
    }
    
    $summaryResults.endpoints += $result
}

# Write summary JSON (Assertion 7)
$outputPath = Join-Path $OutputDir "ab-smoke-summary.json"
$summaryResults | ConvertTo-Json -Depth 10 | Out-File $outputPath -Encoding UTF8

Write-Host ""
Write-Host "Summary saved to: $outputPath"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "DISCLAIMER: Results are smoke-test only. Do NOT use for promotion decisions." -ForegroundColor Yellow
Write-Host "k6 load tests are the authoritative gating metric." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow

# Exit code: 0 if no endpoints failed, 1 if any failed (Assertion 8)
if ($failCount -eq 0) {
    Write-Host "✓ Smoke test passed (endpoints responding)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Smoke test failed ($failCount/$($endpoints.Count) endpoints had failures)" -ForegroundColor Red
    exit 1
}
