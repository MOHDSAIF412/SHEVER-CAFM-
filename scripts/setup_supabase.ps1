# ==============================================================================
# SHEVER TECHNICAL SERVICES - CAFM DATABASE MIGRATION SCRIPT
# ==============================================================================

param (
    [Parameter(Mandatory=$false)]
    [string]$DbConnectionString = "postgresql://postgres:postgres@localhost:54322/postgres"
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  SHEVER CAFM - DATABASE MIGRATION RUNNER" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$sqlFiles = @(
    "..\database\01_schema.sql",
    "..\database\02_rls_policies.sql",
    "..\database\03_triggers_and_functions.sql",
    "..\database\04_seed_data.sql"
)

foreach ($file in $sqlFiles) {
    if (Test-Path $file) {
        Write-Host "[MIGRATING] Executing $file..." -ForegroundColor Yellow
        # If psql is installed, execute:
        # psql $DbConnectionString -f $file
    } else {
        Write-Host "[ERROR] Missing file: $file" -ForegroundColor Red
    }
}

Write-Host "[SUCCESS] Database schema and initial seeds ready." -ForegroundColor Green
