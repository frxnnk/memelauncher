param([Parameter(Mandatory=$true)][string]$OutputName)
$ErrorActionPreference = 'Stop'
$researchPath = Split-Path -Parent $PSScriptRoot
$rows = [System.Collections.Generic.List[object]]::new()
$sources = @(
  @{ file='winners/snapshot.json'; cohort='previous-winners' },
  @{ file='deep/cohort-second.json'; cohort='preipo-fixed-11' },
  @{ file='new-pairs.json'; cohort='additional-pairs' }
)
foreach ($source in $sources) {
  $captures = Get-Content -LiteralPath (Join-Path $researchPath $source.file) -Raw | ConvertFrom-Json
  foreach ($capture in $captures) {
    foreach ($pair in @($capture.data.pairs)) {
      if ($null -ne $pair.pairAddress) {
        $rows.Add([pscustomobject]@{
          cohort=$source.cohort; source=$source.file; baselineAt=$capture.capturedAt; pair=$pair
        })
      }
    }
  }
}
$culturalContracts = @(
  'TH5vjP7bP8mVzVSyRZiCxVUMpTABotrhVQEJNbepump',
  'yf1xw3TZ8ZLbmdYHDW6QEg5bcbKRpP3QNNhqPv5pump',
  '9LyCjVLp5tKyf4BsVvVKrwxm96iCjqAjg7enULvopump',
  'CMJxnanvwVaB6jvah7q9bzNnXXdFcrWDFXZ5DKoYpump',
  '2vR5NfTHstPYceiDnxB1yFq1WWVCiYx9VQ2PFvXApump',
  'J8o93KPiansPDNN8j3rCh54813mN6Gb9HUgMfLs2pump',
  '0x5139f5D185906428f826BDf8053Cb4d825C77777'
)
$cultureFiles = @('deep/steel-expressions.json','social-token-searches.json','deep/resignation-searches.json','deep/robot-expressions.json','deep/robot-searches.json')
foreach ($file in $cultureFiles) {
  $captures = Get-Content -LiteralPath (Join-Path $researchPath $file) -Raw | ConvertFrom-Json
  foreach ($capture in $captures) {
    foreach ($pair in @($capture.data.pairs)) {
      if ($pair.baseToken.address -in $culturalContracts) {
        $rows.Add([pscustomobject]@{
          cohort='cultural-fixed-7'; source=$file; baselineAt=$capture.capturedAt; pair=$pair
        })
      }
    }
  }
}
$seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$selected = @($rows | Where-Object { $seen.Add($_.pair.chainId + '/' + $_.pair.pairAddress) })
$captures = foreach ($row in $selected) {
  $pair = $row.pair
  $url = 'https://api.dexscreener.com/latest/dex/pairs/' + $pair.chainId + '/' + $pair.pairAddress
  $start = [DateTime]::UtcNow.ToString('o')
  try {
    $data = Invoke-RestMethod -Uri $url -TimeoutSec 25
    [pscustomobject]@{
      cohort=$row.cohort; source=$row.source; baselineAt=$row.baselineAt; baseline=$pair
      requestedAt=$start; capturedAt=[DateTime]::UtcNow.ToString('o'); url=$url; data=$data; error=$null
    }
  } catch {
    [pscustomobject]@{
      cohort=$row.cohort; source=$row.source; baselineAt=$row.baselineAt; baseline=$pair
      requestedAt=$start; capturedAt=[DateTime]::UtcNow.ToString('o'); url=$url; data=$null; error=$_.Exception.Message
    }
  }
}
$outputPath = Join-Path $PSScriptRoot ($OutputName + '.json')
$captures | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $outputPath
$summary = foreach ($capture in $captures) {
  $after = @($capture.data.pairs)[0]
  $before = $capture.baseline
  $deltaUsd = $null
  $deltaNative = $null
  if ([double]$before.priceUsd -gt 0 -and $null -ne $after.priceUsd) {
    $deltaUsd = ([double]$after.priceUsd/[double]$before.priceUsd - 1)*100
  }
  if ([double]$before.priceNative -gt 0 -and $null -ne $after.priceNative) {
    $deltaNative = ([double]$after.priceNative/[double]$before.priceNative - 1)*100
  }
  [pscustomobject]@{
    cohort=$capture.cohort; symbol=$before.baseToken.symbol; contract=$before.baseToken.address
    chain=$before.chainId; pair=$before.pairAddress; quote=$before.quoteToken.symbol
    url=$before.url; baselineAt=$capture.baselineAt; capturedAt=$capture.capturedAt
    priceUsd=$after.priceUsd; marketCap=$after.marketCap; liquidity=$after.liquidity.usd
    volume1h=$after.volume.h1; transactions1h=$after.txns.h1; change1h=$after.priceChange.h1
    deltaUsdPct=$deltaUsd; deltaNativePct=$deltaNative; error=$capture.error
  }
}
$summary | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $PSScriptRoot ($OutputName + '-summary.json'))
$summary | ConvertTo-Json -Depth 8 -Compress
