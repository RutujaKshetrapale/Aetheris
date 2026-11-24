param (
    [Parameter(Mandatory=$true)]
    [ValidateSet(
        "1", "react-springboot-mysql",
        "2", "react-springboot-mongodb",
        "3", "react-dotnet-mysql",
        "4", "react-dotnet-mongodb",
        "5", "angular-springboot-mysql",
        "6", "angular-springboot-mongodb",
        "7", "angular-dotnet-mysql",
        "8", "angular-dotnet-mongodb"
    )]
    [string]$Profile,

    [switch]$Down,
    [switch]$Build
)

$profileMap = @{
    "1" = "react-springboot-mysql";
    "2" = "react-springboot-mongodb";
    "3" = "react-dotnet-mysql";
    "4" = "react-dotnet-mongodb";
    "5" = "angular-springboot-mysql";
    "6" = "angular-springboot-mongodb";
    "7" = "angular-dotnet-mysql";
    "8" = "angular-dotnet-mongodb";
}

if ($profileMap.ContainsKey($Profile)) {
    $selectedProfile = $profileMap[$Profile]
} else {
    $selectedProfile = $Profile
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " AETHERIS DEPLOYMENT ORCHESTRATOR" -ForegroundColor Cyan
Write-Host " Selected Profile: $selectedProfile" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$composeFile = Join-Path $PSScriptRoot "configurations\docker-compose.$selectedProfile.yml"
$envFile = Join-Path $PSScriptRoot "configurations\$selectedProfile.env"

if (-not (Test-Path $composeFile)) {
    Write-Error "Compose configuration not found: $composeFile"
    exit 1
}

$action = if ($Down) { "down" } else { "up -d" }
$buildArg = if ($Build) { "--build" } else { "" }

$cmd = "docker compose --env-file `"$envFile`" -f `"$composeFile`" $action $buildArg"
Write-Host "Executing: $cmd" -ForegroundColor Yellow

Invoke-Expression $cmd
