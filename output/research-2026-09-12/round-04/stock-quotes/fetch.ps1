$ErrorActionPreference = 'Stop'
$targetDir = Join-Path $PSScriptRoot 'raw'
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
$sources = @(
  @('coinbase-tokenize.html','https://www.coinbase.com/tokenize'),
  @('base-stocks.html','https://www.base.org/stocks'),
  @('base-docs.html','https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks'),
  @('aapl-prospectus.pdf','https://assets.ctfassets.net/o10es7wu5gm1/6t7LV7NUfghwRYjZpReFYH/6e08881544b683a4c886aaa809c2d51a/Coinbase_Onchain_SPV_Ltd_-_Prospectus__AAPL__-_FSRA_VERSION.pdf'),
  @('googl-prospectus.pdf','https://assets.ctfassets.net/o10es7wu5gm1/4Z7WbCZC0rQ6AkkEV6sBgX/b6ecb474929fa9b4802b258a7ef6e948/Coinbase_Onchain_SPV_Ltd_-_Prospectus__GOOGL__-_FSRA_VERSION.pdf'),
  @('twentypad-quotes.html','https://docs.twentypad.com/docs/launching/quote-assets'),
  @('twentypad-contracts.html','https://docs.twentypad.com/docs/developers/contracts'),
  @('twentypad-router.html','https://docs.twentypad.com/docs/trading/swap-router'),
  @('dex-aaplc.json','https://api.dexscreener.com/token-pairs/v1/base/0xb200000000000000000000C2e324d24d7eEcd1fb'),
  @('dex-googlc.json','https://api.dexscreener.com/token-pairs/v1/base/0xb2000000000000000000002D0BA3164cc74f58B7'),
  @('basescan-aapl.html','https://basescan.org/token/0xb200000000000000000000C2e324d24d7eEcd1fb'),
  @('basescan-googl.html','https://basescan.org/token/0xb2000000000000000000002D0BA3164cc74f58B7')
)
$log = @()
foreach ($entry in $sources) {
  $at = [DateTime]::UtcNow.ToString('o')
  try {
    $resp = Invoke-WebRequest -Uri $entry[1] -UseBasicParsing -TimeoutSec 25 -OutFile (Join-Path $targetDir $entry[0]) -PassThru
    $log += [pscustomobject]@{file=$entry[0];url=$entry[1];atUtc=$at;status=[int]$resp.StatusCode}
  } catch {
    $log += [pscustomobject]@{file=$entry[0];url=$entry[1];atUtc=$at;error=$_.Exception.Message}
  }
}
$log | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $targetDir 'fetch-log.json') -Encoding UTF8
$log | Select-Object file,status,error | Format-Table -AutoSize
