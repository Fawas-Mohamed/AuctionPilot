param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^https://[a-zA-Z0-9-]+\.onrender\.com$')]
    [string] $BackendOrigin,
    [ValidatePattern('^https://[a-zA-Z0-9.-]+$')]
    [string] $FrontendOrigin = 'https://auction-pilot.vercel.app'
)
$ErrorActionPreference = 'Stop'
# Bounded deployment acceptance reads, never continuous monitoring or keep-alives.
function Read-Json([string] $Path) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($BackendOrigin + $Path) -TimeoutSec 120
    if ($response.StatusCode -ne 200) { throw "Expected HTTP 200 for $Path." }
    return ($response.Content | ConvertFrom-Json)
}
$health = Read-Json '/health'
if ($health.status -ne 'ok' -or $health.mode -ne 'portfolio-demo') { throw 'Backend liveness is not the expected demo.' }
$ready = Read-Json '/health/ready'
if ($ready.status -ne 'ready') { throw 'Backend database is not ready.' }
$auctions = @(Read-Json '/api/auctions')
$now = [DateTimeOffset]::UtcNow
foreach ($auction in $auctions) {
    if ($auction -and [DateTimeOffset]::Parse($auction.endTime) -le $now -and -not $auction.isClosed) {
        throw ('Actionable expired auction was not reconciled: ' + $auction.id)
    }
}
$corsRequest = @{
    UseBasicParsing = $true
    Uri = $BackendOrigin + '/api/auctions'
    Method = 'Options'
    Headers = @{ Origin = $FrontendOrigin; 'Access-Control-Request-Method' = 'GET' }
    TimeoutSec = 120
}
$cors = Invoke-WebRequest @corsRequest
if ($cors.Headers['Access-Control-Allow-Origin'] -ne $FrontendOrigin) { throw 'The exact frontend CORS origin is not authorized.' }
$results = @{
    backend = $BackendOrigin
    frontendOrigin = $FrontendOrigin
    passed = @('Demo liveness', 'Database readiness', 'Public auction read and overdue reconciliation', 'Exact CORS preflight')
}
$results | ConvertTo-Json -Depth 4
Write-Output 'PASS: backend is ready for the next preview configuration step.'
