param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$Release,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ArchiveSha256,
  [switch]$AllowTestnetFunding
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = 'C:\vault-beta'
$releasePath = [IO.Path]::GetFullPath("$root\releases\$Release")
if (-not $releasePath.StartsWith("$root\releases\")) { throw 'Invalid release path.' }
$archive = "$root\incoming\beta-$Release.tar.gz"
$node = 'C:\Program Files\nodejs\node.exe'
$npm = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
$nssm = 'C:\ProgramData\chocolatey\lib\NSSM\tools\nssm.exe'
$dataPath = "$root\shared\data"
$betaDb = "$dataPath\beta.sqlite"
$headers = @{Host='vault-closed-beta.vercel.app'}
function Read-Health { Invoke-RestMethod http://127.0.0.1:4319/api/health -Headers $headers -TimeoutSec 10 }
function Set-ServiceRelease($directory, $parameters) {
  & $nssm set vault-beta AppDirectory $directory | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not set service directory.' }
  & $nssm set vault-beta AppParameters $parameters | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not set service parameters.' }
}
function Wait-Healthy {
  for ($attempt=0; $attempt -lt 20; $attempt++) {
    try {
      $health = Read-Health
      if ($health.closedBeta -and $health.state -eq 'beta-paused' -and -not $health.usage.pending -and -not $health.usage.unknown) { return $health }
    } catch {}
    Start-Sleep -Seconds 2
  }
  throw 'Service did not recover to the paused healthy state.'
}
foreach ($path in @($archive,$node,$npm,$nssm,$dataPath,$betaDb,"$root\shared\.env")) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing deployment input: $path" }
}
if ((Get-Service vault-beta).Status -ne 'Running') { throw 'Inspect the stopped service before upgrading.' }
$old = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\vault-beta\Parameters'
$oldDirectory = [IO.Path]::GetFullPath($old.AppDirectory)
if (-not $oldDirectory.StartsWith("$root\releases\")) { throw 'Unexpected existing release path.' }
if (Test-Path -LiteralPath $releasePath) { throw 'Release exists; inspect before retrying.' }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ArchiveSha256) { throw 'Archive digest mismatch.' }
$before = Read-Health
if ($before.state -ne 'requests-enabled' -or $before.usage.pending -or $before.usage.unknown -or $before.execution.busy) { throw 'Only upgrade a healthy idle beta.' }
$funding = Invoke-RestMethod http://127.0.0.1:4319/api/auth/config -Headers $headers -TimeoutSec 10
$fundingBefore = Invoke-RestMethod http://127.0.0.1:4319/api/funding/config -Headers $headers -TimeoutSec 10
if ($funding.webFundingEnabled) {
  if (-not $AllowTestnetFunding -or $fundingBefore.environment -ne 'testnet' -or $fundingBefore.asset.chainId -ne '46630' -or
      $fundingBefore.realFundsEnabled -ne $false -or $fundingBefore.payoutsEnabled -ne $false) { throw 'Explicit Robinhood testnet funding upgrade required; real funds are unsupported.' }
}
$entries = @(& tar -tzf $archive)
if ($LASTEXITCODE -ne 0 -or $entries.Count -lt 100) { throw 'Invalid archive.' }
foreach ($entry in $entries) {
  if ($entry -match '(^/|^[A-Za-z]:|\\|(^|/)\.\.(/|$)|(^|/)\.env$|(^|/)\.local(/|$))') { throw 'Unsafe or private archive entry.' }
}
New-Item -ItemType Directory -Path $releasePath | Out-Null
& tar -xzf $archive -C $releasePath
if ($LASTEXITCODE -ne 0) { throw 'Extraction failed.' }
$manifest = Get-Content -Raw -LiteralPath "$releasePath\RELEASE.json" | ConvertFrom-Json
if (-not $manifest.sourceId.StartsWith($Release)) { throw 'Release identity mismatch.' }
foreach ($property in $manifest.files.PSObject.Properties) {
  $path = [IO.Path]::GetFullPath((Join-Path $releasePath $property.Name))
  if (-not $path.StartsWith($releasePath + '\')) { throw 'Unsafe manifest path.' }
  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $property.Value) { throw 'Source digest mismatch.' }
}
Push-Location $releasePath
try { & $node $npm ci --ignore-scripts; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' } }
finally { Pop-Location }
New-Item -ItemType Junction -Path "$releasePath\.local" -Target $dataPath | Out-Null
& icacls $releasePath /grant 'NT SERVICE\vault-beta:(OI)(CI)RX' /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Release read permission failed.' }
$backup = "$root\shared\backups\data-before-$Release-$(Get-Date -Format yyyyMMddHHmmss)"
if (Test-Path -LiteralPath $backup) { throw 'Backup destination exists.' }
$paused = $false
$switched = $false
try {
  & $node "$oldDirectory\scripts\beta.mjs" pause --db $betaDb | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not pause admission.' }
  $paused = $true
  $drained = Wait-Healthy
  $fundingBefore = Invoke-RestMethod http://127.0.0.1:4319/api/funding/config -Headers $headers -TimeoutSec 10
  Stop-Service vault-beta
  (Get-Service vault-beta).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(60))
  Copy-Item -LiteralPath $dataPath -Destination $backup -Recurse
  $copyProof = & $node "$releasePath\audit\verify-storage-copy.mjs" $dataPath $backup
  if ($LASTEXITCODE -ne 0) { throw 'Storage backup verification failed.' }
  $switched = $true
  Set-ServiceRelease $releasePath "--env-file=$root\shared\.env $releasePath\server.mjs"
  Start-Service vault-beta
  $after = Wait-Healthy
  foreach ($field in @('globalRequestsToday','reportedCostUsd','known','unknown','pending','budgetUsd','totalPerDay')) {
    if ($after.usage.$field -ne $drained.usage.$field) { throw "Persistent usage changed during restart: $field" }
  }
  if ($after.execution.storedSessions -ne $drained.execution.storedSessions) { throw 'Session count changed during restart.' }
  $fundingAfter = Invoke-RestMethod http://127.0.0.1:4319/api/funding/config -Headers $headers -TimeoutSec 10
  if ($fundingAfter.environment -ne 'testnet' -or $fundingAfter.realFundsEnabled -ne $false -or $fundingAfter.payoutsEnabled -ne $false) {
    throw 'Funding left testnet-only constraints.'
  }
  if ($fundingAfter.asset.chainId -ne $fundingBefore.asset.chainId -or $fundingAfter.asset.tokenAddress -ne $fundingBefore.asset.tokenAddress -or
      $fundingAfter.asset.destination -ne $fundingBefore.asset.destination) { throw 'Funding asset changed during upgrade.' }
  $beforeRounds = $fundingBefore.rounds | ForEach-Object { "$($_.id)|$($_.state)|$($_.price)|$($_.bounty)|$($_.prizePayable)" }
  $afterRounds = $fundingAfter.rounds | ForEach-Object { "$($_.id)|$($_.state)|$($_.price)|$($_.bounty)|$($_.prizePayable)" }
  if (($beforeRounds -join ';') -ne ($afterRounds -join ';')) {
    throw 'Funding asset, custody, round terms or balances changed during upgrade.'
  }
  & $node "$releasePath\scripts\beta.mjs" resume --db $betaDb | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not resume admission.' }
  if ((Read-Health).state -ne 'requests-enabled') { throw 'Admission did not reopen.' }
  $paused = $false
  $proof = @{checkedAt=(Get-Date).ToUniversalTime().ToString('o'); release=$releasePath; previous=$oldDirectory; archiveSha256=$ArchiveSha256; backup=$backup; storage=($copyProof | ConvertFrom-Json); usagePreserved=$true; sessionsPreserved=$true; fundingEnabled=$fundingBefore.enabled; fundingConfigurationPreserved=$true; state='requests-enabled'}
  $proof | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$root\shared\upgrade-$Release.json" -Encoding UTF8
  $proof | ConvertTo-Json -Depth 5
} catch {
  $failure = $_
  if ($paused) {
    try {
      & $node "$oldDirectory\scripts\beta.mjs" pause --db $betaDb | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Could not preserve paused admission for recovery.' }
      if ((Get-Service vault-beta).Status -ne 'Stopped') { Stop-Service vault-beta }
      if ($switched) { Set-ServiceRelease $oldDirectory $old.AppParameters }
      Start-Service vault-beta
      $recovered = Wait-Healthy
      & $node "$oldDirectory\scripts\beta.mjs" resume --db $betaDb | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Rollback admission remains paused.' }
      Write-Warning 'Previous code restored with current storage. No database rollback was performed.'
    } catch { Write-Warning 'Automatic recovery could not complete. Keep the beta paused and inspect the service.' }
  }
  throw $failure
}
