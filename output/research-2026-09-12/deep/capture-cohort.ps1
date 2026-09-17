param([Parameter(Mandatory = $true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
# Fixed sample: all 11 OPENAIx1L/ANTHROPICx1L quote rows observed in
# Robinhood DEX Screener trending6h top100 at approximately04:38UTC.
# This is a selected sample, not a census or a recommendation.
$pairIds = @(
  '0x086f510359ad57e4f8588b71ffa21fe29bbed044e4d13aa2f72ecaefeda95a36',
  '0xaf28b153a45c4647ed76860811f734152e3c93e29c6a4489691954b71716d310',
  '0x6e40cd967162fb4430c8b5ae934b40d10375c2812986fb9a7d2f04340631de28',
  '0xc218e2ea7aba9a20e324dbe391dc5e712341195ff24b3d78ba70ae836740a916',
  '0x3b48256216db57a3411e12238b4ecd3e218e3b6c3cd0cdf914875eefce09a3b1',
  '0xbfe91882eba961ca01ee3f21b864b299d48402d47dfc48d5a977b077b934319c',
  '0x29abb6131c0ca1253ab9e9e766e91bc201e2f90330d937e5aafd9836a9345f4d',
  '0xbf2be8eb9bcb5bd197a319d94f4986d67b71667af4185cc658daae383f8642a2',
  '0x352a08962375a6dbb23e2604dbacf7a9ed60198745639e3c99c19ba2b1c8c2a3',
  '0x5bfc483992fec583051b50c3ba390046bd81a9b6aa94eaaade4a00724f40c977',
  '0x612f0bc0e979cbe7a440173b2e06bc90a594ac3402c75c44ec822ce98a745633'
)
$captures = foreach ($pairId in $pairIds) {
  $url = 'https://api.dexscreener.com/latest/dex/pairs/robinhood/' + $pairId
  $startedAt = [DateTime]::UtcNow.ToString('o')
  $data = Invoke-RestMethod -Uri $url -TimeoutSec 25
  [pscustomobject]@{
    requestedAt = $startedAt
    capturedAt = [DateTime]::UtcNow.ToString('o')
    url = $url
    data = $data
  }
}
$captures | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $OutputPath
$captures | ForEach-Object { $_.data.pairs } | ForEach-Object {
  [pscustomobject]@{
    symbol = $_.baseToken.symbol
    contract = $_.baseToken.address
    quote = $_.quoteToken.symbol
    mc = $_.marketCap
    liq = $_.liquidity.usd
    priceUsd = $_.priceUsd
    priceNative = $_.priceNative
    v1h = $_.volume.h1
    change1h = $_.priceChange.h1
  } | ConvertTo-Json -Compress
}
