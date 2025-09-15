Param(
  [string]$Tag = "0.3.118-wmde.10",
  [string]$JnlPath = "C:\Users\caleb\jnl\wikidata.jnl",
  [string]$Port = "9999",
  [string]$Heap = "24g",
  [int]$WaitSeconds = 1200,
  [string]$RestartPolicy = "unless-stopped",
  [string[]]$TryTags = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($TryTags.Count -gt 0) {
  Write-Host "[wdqs] Trying tags (in order): $($TryTags -join ', ')"
} else {
  Write-Host "[wdqs] Using tag=$Tag, jnl=$JnlPath, port=$Port, heap=$Heap"
}

# Derive mount directory and file name so we can mount in-place without copying 1TB
$MountDir = Split-Path -Parent $JnlPath
$JnlFile  = Split-Path -Leaf $JnlPath
if (-not (Test-Path $MountDir)) { Write-Error "Mount directory not found: $MountDir"; exit 1 }
if (-not (Test-Path $JnlPath))  { Write-Error "JNL file not found: $JnlPath"; exit 1 }

function Start-Wdqs($useTag) {
  Write-Host "[wdqs] Pulling image wikibase/wdqs:$useTag"
  docker pull wikibase/wdqs:$useTag | Write-Host
  Write-Host "[wdqs] Starting container mounting existing JNL directory..."
  $existing = docker ps -a --format '{{.Names}}' | Where-Object { $_ -eq 'wdqs' }
  if ($existing) { docker rm -f wdqs | Out-Null }
  docker run -d --name wdqs --restart $RestartPolicy -p "${Port}:${Port}" -v "${MountDir}:/wdqs/data" $envVars wikibase/wdqs:$useTag | Write-Host
  # Quick visibility check
  Write-Host "[wdqs] Verifying mounted journal visibility inside container..."
  docker exec wdqs bash -lc "set -e; ls -lh /wdqs/data; echo 'Journal check:'; if [ -f /wdqs/data/$JnlFile ]; then stat -c '%n %s bytes' /wdqs/data/$JnlFile; else echo 'MISSING: /wdqs/data/$JnlFile'; fi" | Write-Host
  # Surface recent logs
  Write-Host "[wdqs] Recent log lines (looking for journal open path):"
  docker logs --tail 120 wdqs | Write-Host
}

# Some wdqs images require WIKIBASE_HOST to be set even if unused when only serving a JNL.
$envVars = @(
  "-e", "WIKIBASE_HOST=www.wikidata.org",
  "-e", "WDQS_HOST=localhost",
  "-e", "WDQS_PORT=$Port",
  "-e", "WDQS_LOAD=false",
  "-e", "HEAP_SIZE=$Heap",
  "-e", "JETTY_PORT=$Port",
  "-e", "BLAZEGRAPH_OPTS=-Dcom.bigdata.journal.AbstractJournal.file=/wdqs/data/$JnlFile -DwikibaseConceptUri=https://www.wikidata.org",
  "-e", "JOURNAL=/wdqs/data/$JnlFile"
)

if ($TryTags.Count -gt 0) {
  $selected = $null
  foreach ($t in $TryTags) {
    Write-Host "[wdqs] Attempting tag $t"
    Start-Wdqs -useTag $t
    $endpointCandidates = @(
      "http://localhost:$Port/bigdata/namespace/wdq/sparql",
      "http://localhost:$Port/bigdata/sparql",
      "http://localhost:$Port/blazegraph/namespace/kb/sparql"
    )
    $ok = $false
    for ($i=0; $i -lt 60 -and -not $ok; $i++) {
      foreach ($u in $endpointCandidates) {
        try {
          $r = Invoke-WebRequest -UseBasicParsing -Uri $u -Method Get -TimeoutSec 3
          if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ok = $true; break }
        } catch {}
      }
      if (-not $ok) { Start-Sleep -Seconds 2 }
    }
    if ($ok) { $selected = $t; break }
    Write-Host "[wdqs] Tag $t did not serve the endpoint quickly; trying next..." -ForegroundColor Yellow
  }
  if (-not $selected) { Write-Error "No tags produced a responsive endpoint."; exit 1 }
  Write-Host "[wdqs] Selected tag: $selected"
  $Tag = $selected
} else {
  Start-Wdqs -useTag $Tag
}

# Quick visibility check: ensure the journal is seen inside the container and show its size
Write-Host "[wdqs] Verifying mounted journal visibility inside container..."
docker exec wdqs bash -lc "set -e; ls -lh /wdqs/data; echo 'Journal check:'; if [ -f /wdqs/data/$JnlFile ]; then stat -c '%n %s bytes' /wdqs/data/$JnlFile; else echo 'MISSING: /wdqs/data/$JnlFile'; fi" | Write-Host

# Surface recent logs to see which journal path Blazegraph actually opened
Write-Host "[wdqs] Recent log lines (looking for journal open path):"
docker logs --tail 120 wdqs | Write-Host

$endpointCandidates = @(
  "http://localhost:$Port/bigdata/namespace/wdq/sparql",
  "http://localhost:$Port/bigdata/sparql",
  "http://localhost:$Port/blazegraph/namespace/kb/sparql"
)

Write-Host "[wdqs] Waiting up to $WaitSeconds seconds for SPARQL endpoint..."
$ok = $false
$start = Get-Date
${restartAttempted} = $false
while (-not $ok -and ((Get-Date) - $start).TotalSeconds -lt $WaitSeconds) {
  try {
    $running = (docker inspect -f "{{.State.Running}}" wdqs) -eq "true"
  } catch { $running = $false }
  if (-not $running) {
    if (-not $restartAttempted) {
      Write-Host "[wdqs] Container not running; attempting one restart..." -ForegroundColor Yellow
      try { docker start wdqs | Out-Null } catch {}
      Start-Sleep -Seconds 5
      $restartAttempted = $true
      continue
    }
    Write-Host "[wdqs] Container not running after restart; last 200 log lines:" -ForegroundColor Yellow
    docker logs --tail 200 wdqs | Write-Host
    Write-Error "WDQS container exited and did not recover."; exit 1
  }
  foreach ($u in $endpointCandidates) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $u -Method Get -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
        Write-Host "[wdqs] Endpoint up: $u"
        $ok = $true
        break
      }
    } catch {}
  }
  if (-not $ok) { Start-Sleep -Seconds 5 }
}

if (-not $ok) {
  Write-Host "[wdqs] Timed out; last 200 log lines:" -ForegroundColor Yellow
  docker logs --tail 200 wdqs | Write-Host
  Write-Error "WDQS did not become ready on expected endpoints."; exit 1
}

Write-Host "[wdqs] Done. You can query the endpoint from the importer."

