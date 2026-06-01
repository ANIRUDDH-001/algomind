#!/usr/bin/env pwsh
# @codesage | @file: scripts/collect-benchmarks.ps1 | @purpose: Collects code quality, architecture, build, and content metrics for the project | @audit: CODESAGE-v1
<#
.SYNOPSIS
    AlgoMind Performance & Codebase Benchmarks — Hackathon Submission Data Collector
.DESCRIPTION
    Collects code quality, architecture, build, and content metrics.
    No API keys or secrets are used. Safe to commit and share.
.EXAMPLE
    pwsh scripts/collect-benchmarks.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AlgoMind — Benchmark Collector" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# ── A. Code Quality & Scale ──────────────────────────────────────────

Write-Host "▸ [A] Code Quality & Scale" -ForegroundColor Yellow

# Lines of code
$exts = @('*.ts','*.tsx','*.css','*.sql','*.mjs','*.js')
$totalLines = 0; $totalFiles = 0
foreach ($ext in $exts) {
    $files = Get-ChildItem -Path "$root/src","$root/scripts","$root/supabase" -Recurse -Include $ext -ErrorAction SilentlyContinue
    $lines = 0; $count = 0
    foreach ($f in $files) {
        $lines += (Get-Content $f.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
        $count++
    }
    $totalLines += $lines; $totalFiles += $count
    Write-Host "  $ext : $count files, $lines lines"
}
Write-Host "  TOTAL: $totalFiles source files, $totalLines lines of code" -ForegroundColor Green

# TypeScript
Write-Host "`n  TypeScript strict-mode check..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$tscOutput = npx tsc --noEmit 2>&1 | Out-String
$sw.Stop()
$tscErrors = ([regex]::Matches($tscOutput, 'error TS')).Count
Write-Host "  TSC errors: $tscErrors | Time: $($sw.Elapsed.TotalSeconds.ToString('F1'))s" -ForegroundColor $(if ($tscErrors -eq 0) {'Green'} else {'Red'})

# ESLint
Write-Host "`n  ESLint..."
$eslintOutput = npx eslint . 2>&1 | Out-String
$eslintErrors = ([regex]::Matches($eslintOutput, '\d+ error')).Count
$eslintSummary = $eslintOutput -split "`n" | Where-Object { $_ -match 'problems' } | Select-Object -First 1
Write-Host "  $($eslintSummary.Trim())" -ForegroundColor $(if ($eslintErrors -eq 0) {'Green'} else {'Red'})

# Tests
Write-Host "`n  Vitest..."
$testOutput = npx vitest run 2>&1 | Out-String
$testSummary = $testOutput -split "`n" | Where-Object { $_ -match 'Tests\s+\d+' } | Select-Object -First 1
$fileSummary = $testOutput -split "`n" | Where-Object { $_ -match 'Test Files\s+\d+' } | Select-Object -First 1
$durationLine = $testOutput -split "`n" | Where-Object { $_ -match 'Duration' } | Select-Object -First 1
Write-Host "  $($fileSummary.Trim())" -ForegroundColor Green
Write-Host "  $($testSummary.Trim())" -ForegroundColor Green
Write-Host "  $($durationLine.Trim())"

# Test files
$testFileCount = (Get-ChildItem -Path "$root/src","$root/tests" -Recurse -Include '*.test.ts','*.test.tsx','*.spec.ts','*.spec.tsx' -ErrorAction SilentlyContinue).Count
Write-Host "  Test files: $testFileCount"

# ── B. Architecture Metrics ──────────────────────────────────────────

Write-Host "`n▸ [B] Architecture Metrics" -ForegroundColor Yellow
$apiRoutes = (Get-ChildItem -Path "$root/src/app/api" -Recurse -Include 'route.ts' -ErrorAction SilentlyContinue).Count
$components = (Get-ChildItem -Path "$root/src/components" -Recurse -Include '*.tsx' -ErrorAction SilentlyContinue).Count
$componentDirs = (Get-ChildItem -Path "$root/src/components" -Directory -ErrorAction SilentlyContinue).Count
$hooks = @(Get-ChildItem -Path "$root/src/hooks" -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.ts','.tsx' }).Count
$libModules = (Get-ChildItem -Path "$root/src/lib" -Directory -ErrorAction SilentlyContinue).Count
$libFiles = (Get-ChildItem -Path "$root/src/lib" -Recurse -Include '*.ts' -ErrorAction SilentlyContinue).Count
$pages = (Get-ChildItem -Path "$root/src/app" -Recurse -Include 'page.tsx' -ErrorAction SilentlyContinue).Count
$actions = @(Get-ChildItem -Path "$root/src/app/actions" -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq '.ts' }).Count
$types = @(Get-ChildItem -Path "$root/src/types" -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq '.ts' }).Count

Write-Host "  API routes:     $apiRoutes"
Write-Host "  React components: $components (across $componentDirs dirs)"
Write-Host "  Custom hooks:   $hooks"
Write-Host "  Lib modules:    $libModules dirs, $libFiles files"
Write-Host "  App pages:      $pages"
Write-Host "  Server actions:  $actions"
Write-Host "  Type defs:      $types"

# Dependencies
$pkg = Get-Content "$root/package.json" -Raw | ConvertFrom-Json
$prodDeps = @($pkg.dependencies.PSObject.Properties).Count
$devDeps = @($pkg.devDependencies.PSObject.Properties).Count
Write-Host "  Dependencies:   $prodDeps prod + $devDeps dev = $($prodDeps + $devDeps) total"

# Database
if (Test-Path "$root/schema details/supabase_schema.sql") {
    $schema = Get-Content "$root/schema details/supabase_schema.sql" -Raw
    $dbTables = ([regex]::Matches($schema, 'CREATE TABLE')).Count
    $rlsPolicies = ([regex]::Matches($schema, 'CREATE POLICY')).Count
    $dbFunctions = ([regex]::Matches($schema, 'CREATE.*FUNCTION')).Count
    $dbIndexes = ([regex]::Matches($schema, 'CREATE.*INDEX')).Count
    Write-Host "  DB tables:      $dbTables"
    Write-Host "  RLS policies:   $rlsPolicies"
    Write-Host "  DB functions:   $dbFunctions"
    Write-Host "  DB indexes:     $dbIndexes"
}

# ── C. Build Performance ─────────────────────────────────────────────

Write-Host "`n▸ [C] Build Performance" -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
npm run build 2>&1 | Out-Null
$sw.Stop()
Write-Host "  Production build time: $($sw.Elapsed.TotalSeconds.ToString('F1'))s" -ForegroundColor Green

if (Test-Path "$root/.next/static") {
    $staticAssets = Get-ChildItem -Path "$root/.next/static" -Recurse -File -ErrorAction SilentlyContinue
    $totalSize = ($staticAssets | Measure-Object -Property Length -Sum).Sum
    $jsSize = ($staticAssets | Where-Object { $_.Extension -eq '.js' } | Measure-Object -Property Length -Sum).Sum
    $cssSize = ($staticAssets | Where-Object { $_.Extension -eq '.css' } | Measure-Object -Property Length -Sum).Sum
    Write-Host "  Bundle total:   $([math]::Round($totalSize / 1KB))KB ($($staticAssets.Count) files)"
    Write-Host "  JS chunks:      $([math]::Round($jsSize / 1KB))KB"
    Write-Host "  CSS:            $([math]::Round($cssSize / 1KB))KB"
}

# ── F. Content Metrics ───────────────────────────────────────────────

Write-Host "`n▸ [F] Content & Knowledge" -ForegroundColor Yellow

# Vocabulary
$vocabFile = Get-ChildItem -Path "$root/src" -Recurse -File | Where-Object { $_.Name -eq 'vocabulary.ts' -and $_.FullName -notmatch '__tests__' } | Select-Object -First 1
if ($vocabFile) {
    $vocabContent = Get-Content $vocabFile.FullName -Raw
    $vocabCount = ([regex]::Matches($vocabContent, '^\s+"[^"]+"', [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
    Write-Host "  DSA vocabulary: $vocabCount terms"
}

# Knowledge base
$knowledgeFiles = Get-ChildItem -Path "$root/src/data/dsa-knowledge/raw" -Include '*.md' -ErrorAction SilentlyContinue
Write-Host "  Knowledge base: $($knowledgeFiles.Count) topic files"

# RAG embeddings
$embFile = "$root/src/data/dsa-knowledge/embeddings/embeddings.json"
if (Test-Path $embFile) {
    $embContent = Get-Content $embFile -Raw
    $chunks = ([regex]::Matches($embContent, '"id"')).Count
    Write-Host "  RAG chunks:     $chunks (embedding vectors)"
    Write-Host "  Embedding size: $([math]::Round((Get-Item $embFile).Length / 1MB, 1))MB"
}

# Total project files
$allFiles = (Get-ChildItem -Path "$root/src","$root/scripts","$root/supabase","$root/tests","$root/public" -Recurse -File -ErrorAction SilentlyContinue).Count
Write-Host "  Total project files: $allFiles"

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Benchmark collection complete!" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
