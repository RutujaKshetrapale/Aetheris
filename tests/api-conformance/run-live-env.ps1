param(
    [string]$JavaExe = $(if (Test-Path "C:\tools\jdk25\bin\java.exe") { "C:\tools\jdk25\bin\java.exe" } else { "java" }),
    [string]$DotnetExe = $(if (Test-Path "C:\tools\dotnet\dotnet.exe") { "C:\tools\dotnet\dotnet.exe" } else { "dotnet" }),
    [string]$NodeExe = $(if (Test-Path "C:\tools\node26\node.exe") { "C:\tools\node26\node.exe" } else { "node" }),
    [int]$SpringPort = 18080,
    [int]$SpringOutagePort = 18081,
    [int]$DotnetPort = 15000,
    [int]$DotnetOutagePort = 15001
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$jarPath = Join-Path $repoRoot "backends\spring-boot\target\aetheris-backend-springboot-2.1.0.jar"
$dotnetDll = Join-Path $repoRoot "backends\dotnet\Aetheris.Api\bin\Debug\net11.0\Aetheris.Api.dll"

if (-not (Test-Path $jarPath)) { throw "Missing Spring Boot JAR at $jarPath. Run mvn package -DskipTests first." }
if (-not (Test-Path $dotnetDll)) { throw "Missing .NET DLL at $dotnetDll. Run dotnet build first." }

function Wait-ForHealth($url, $proc) {
    for ($i = 0; $i -lt 60; $i++) {
        if ($proc.HasExited) {
            throw "Process $($proc.Id) exited prematurely with code $($proc.ExitCode) while starting $url"
        }
        try {
            $resp = Invoke-WebRequest -Uri "$url/api/v1/health/live" -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -eq 200) { return }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    throw "Timed out waiting for $url/api/v1/health/live"
}

$procs = @()
try {
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
    $env:DOTNET_ROOT = Split-Path $DotnetExe -Parent

    # Start Spring Boot (IN_MEMORY)
    $p1 = Start-Process -FilePath $JavaExe -ArgumentList "-jar", "`"$jarPath`"", "--server.port=$SpringPort", "--aetheris.persistence.engine=IN_MEMORY" -PassThru -NoNewWindow
    $procs += $p1

    # Start Spring Boot (MYSQL boundary)
    $p2 = Start-Process -FilePath $JavaExe -ArgumentList "-jar", "`"$jarPath`"", "--server.port=$SpringOutagePort", "--aetheris.persistence.engine=MYSQL" -PassThru -NoNewWindow
    $procs += $p2

    # Start .NET 11 (IN_MEMORY)
    $p3 = Start-Process -FilePath $DotnetExe -ArgumentList "`"$dotnetDll`"", "--urls", "http://127.0.0.1:$DotnetPort", "--Aetheris:Persistence:Engine=IN_MEMORY" -PassThru -NoNewWindow
    $procs += $p3

    # Start .NET 11 (MYSQL boundary)
    $p4 = Start-Process -FilePath $DotnetExe -ArgumentList "`"$dotnetDll`"", "--urls", "http://127.0.0.1:$DotnetOutagePort", "--Aetheris:Persistence:Engine=MYSQL" -PassThru -NoNewWindow
    $procs += $p4

    Wait-ForHealth "http://127.0.0.1:$SpringPort" $p1
    Wait-ForHealth "http://127.0.0.1:$SpringOutagePort" $p2
    Wait-ForHealth "http://127.0.0.1:$DotnetPort" $p3
    Wait-ForHealth "http://127.0.0.1:$DotnetOutagePort" $p4

    $env:SPRING_BOOT_URL = "http://127.0.0.1:$SpringPort"
    $env:DOTNET_URL = "http://127.0.0.1:$DotnetPort"
    $env:SPRING_OUTAGE_URL = "http://127.0.0.1:$SpringOutagePort"
    $env:DOTNET_OUTAGE_URL = "http://127.0.0.1:$DotnetOutagePort"

    & $NodeExe (Join-Path $PSScriptRoot "run-conformance.js")
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Conformance suite exited with code $exitCode"
    }

    Write-Host "`n=== Live HTTP Verification Snapshots ==="
    Write-Host "--- Spring Boot GET /api/v1/health ---"
    (Invoke-WebRequest -Uri "http://127.0.0.1:$SpringPort/api/v1/health" -UseBasicParsing).Content
    Write-Host "`n--- .NET 11 GET /api/v1/health ---"
    (Invoke-WebRequest -Uri "http://127.0.0.1:$DotnetPort/api/v1/health" -UseBasicParsing).Content
    Write-Host "`n--- Spring Boot MYSQL Stub GET /api/v1/presets (503) ---"
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:$SpringOutagePort/api/v1/presets" -UseBasicParsing | Out-Null
    } catch {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $sr.ReadToEnd()
    }
}
finally {
    foreach ($p in $procs) {
        if ($p -and -not $p.HasExited) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
