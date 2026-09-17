param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$Release)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = 'C:\vault-beta'
$releasePath = [IO.Path]::GetFullPath("$root\releases\$Release")
if (-not $releasePath.StartsWith("$root\releases\")) { throw 'Invalid release path.' }
$archive = "$root\incoming\beta.tar.gz"
$node = 'C:\Program Files\nodejs\node.exe'
$npm = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
$nssm = 'C:\ProgramData\chocolatey\lib\NSSM\tools\nssm.exe'
$caddy = 'C:\ferced\caddy\caddy.exe'
$caddyConfig = 'C:\ferced\caddy\Caddyfile'
foreach ($path in @($archive,$node,$npm,$nssm,$caddy,$caddyConfig,"$root\shared\.env")) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing deployment input: $path" }
}
if (Get-Service vault-beta -ErrorAction SilentlyContinue) { throw 'Initial installer refuses to replace an existing service. Use the upgrade runbook.' }
if (Test-Path -LiteralPath $releasePath) { throw 'Release already exists. Inspect before retrying.' }
if (Get-NetTCPConnection -State Listen -LocalPort 4319 -ErrorAction SilentlyContinue) { throw 'Port 4319 is occupied.' }
$entries = @(& tar -tzf $archive)
if ($LASTEXITCODE -ne 0 -or $entries.Count -lt 100) { throw 'Invalid archive.' }
foreach ($entry in $entries) {
  if ($entry -match '(^/|^[A-Za-z]:|(^|/)\.\.(/|$)|(^|/)\.env$|(^|/)\.local(/|$))') { throw 'Private or unsafe archive path.' }
}
New-Item -ItemType Directory -Path $releasePath,"$root\shared\data","$root\shared\logs","$root\shared\backups" -Force | Out-Null
& tar -xzf $archive -C $releasePath
if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed.' }
$manifest = Get-Content -Raw -LiteralPath "$releasePath\RELEASE.json" | ConvertFrom-Json
foreach ($property in $manifest.files.PSObject.Properties) {
  $path = [IO.Path]::GetFullPath((Join-Path $releasePath $property.Name))
  if (-not $path.StartsWith($releasePath + '\')) { throw 'Unsafe manifest path.' }
  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $property.Value) { throw "Source mismatch: $($property.Name)" }
}
Push-Location $releasePath
try { & $node $npm ci --ignore-scripts; if ($LASTEXITCODE -ne 0) { throw 'Locked dependency installation failed.' } }
finally { Pop-Location }
New-Item -ItemType Junction -Path "$releasePath\.local" -Target "$root\shared\data" | Out-Null
& $nssm install vault-beta $node
if ($LASTEXITCODE -ne 0) { throw 'Service creation failed.' }
& $nssm set vault-beta AppDirectory $releasePath
& $nssm set vault-beta AppParameters "--env-file=$root\shared\.env $releasePath\server.mjs"
& $nssm set vault-beta ObjectName 'NT SERVICE\vault-beta'
if ($LASTEXITCODE -ne 0) { throw 'The dedicated service identity could not be configured.' }
& $nssm set vault-beta AppStdout "$root\shared\logs\stdout.log"
& $nssm set vault-beta AppStderr "$root\shared\logs\stderr.log"
& $nssm set vault-beta AppRotateFiles 1
& $nssm set vault-beta AppRotateBytes 1048576
& $nssm set vault-beta AppRestartDelay 5000
& $nssm set vault-beta AppStopMethodConsole 60000
& $nssm set vault-beta Start SERVICE_AUTO_START
& icacls $root /grant 'NT SERVICE\vault-beta:(OI)(CI)RX' /Q
foreach ($directory in @("$root\shared\data","$root\shared\logs")) { & icacls $directory /grant 'NT SERVICE\vault-beta:(OI)(CI)M' /Q; if ($LASTEXITCODE -ne 0) { throw 'Writable storage ACL failed.' } }
if ($LASTEXITCODE -ne 0) { throw 'Service storage permissions failed.' }
Start-Service vault-beta
$ready = $false
for ($attempt=0; $attempt -lt 15; $attempt++) {
  try { $status=Invoke-RestMethod http://127.0.0.1:4319/api/status -Headers @{Host='vault-closed-beta.vercel.app'}; if ($status.closedBeta -and $status.configured) { $ready=$true; break } } catch {}
  Start-Sleep -Seconds 2
}
if (-not $ready) { Stop-Service vault-beta; throw 'Beta failed its local startup check. Proxy was not changed.' }
$before = [IO.File]::ReadAllText($caddyConfig)
if ($before.Contains('vault-beta-api.173.212.246.68.sslip.io')) { throw 'The beta proxy already exists; inspect before editing.' }
$block = @'

# Vault closed beta: dedicated process and persistence.
vault-beta-api.173.212.246.68.sslip.io {
    handle /api/* {
        reverse_proxy 127.0.0.1:4319 {
            header_up Host vault-closed-beta.vercel.app
        }
    }
    handle {
        respond 404
    }
}
'@
$candidate = "$root\shared\Caddyfile.candidate"
[IO.File]::WriteAllText($candidate,$before+$block,[Text.UTF8Encoding]::new($false))
& $caddy validate --config $candidate --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Candidate proxy configuration is invalid; active proxy was not changed.' }
if ([IO.File]::ReadAllText($caddyConfig) -ne $before) { throw 'Proxy changed concurrently; not overwriting it.' }
$backup = "$root\shared\backups\Caddyfile.before-vault-$(Get-Date -Format yyyyMMddHHmmss)"
Copy-Item -LiteralPath $caddyConfig -Destination $backup
[IO.File]::WriteAllText($caddyConfig,$before+$block,[Text.UTF8Encoding]::new($false))
& $caddy reload --config $caddyConfig --adapter caddyfile
if ($LASTEXITCODE -ne 0) {
  Copy-Item -LiteralPath $backup -Destination $caddyConfig -Force
  & $caddy reload --config $caddyConfig --adapter caddyfile
  throw 'Beta proxy reload failed; previous file restored.'
}
@{service='vault-beta';release=$releasePath;sourceId=$manifest.sourceId;proxyBackup=$backup;localCheck='passed';https='requires-external-verification'} | ConvertTo-Json -Compress
