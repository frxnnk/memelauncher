$ErrorActionPreference='Stop'
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'markets.json') -Raw | ConvertFrom-Json
$feeCapture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ember-fees.json') -Raw | ConvertFrom-Json
$asOf=[DateTimeOffset]'2026-09-12T06:45:00Z'
$groups=@($source.markets | Group-Object -Property mint -CaseSensitive)
$dedup=@($groups | ForEach-Object { $_.Group | Sort-Object createdAt -Descending | Select-Object -First 1 })
function Sum-Field($rows,[string]$field){
  $total=0.0
  foreach($row in $rows){$value=$row;foreach($part in $field.Split('.')){$value=$value.$part};if($null -ne $value){$total += [double]$value}}
  return $total
}
function Describe($rows){
  $count=@($rows).Count
  return [pscustomobject]@{
    rows=$count;graduated=@($rows | Where-Object graduated).Count;suspect=@($rows | Where-Object suspect).Count
    capLe10k=@($rows | Where-Object { $null -ne $_.marketCapUsd -and $_.marketCapUsd -le 10000 }).Count
    capGt100k=@($rows | Where-Object { $_.marketCapUsd -gt 100000 }).Count
    volume24hPositive=@($rows | Where-Object { $_.volume24hUsd -gt 0 }).Count
    volume24hGt1k=@($rows | Where-Object { $_.volume24hUsd -gt 1000 }).Count
    trades24hPositive=@($rows | Where-Object { $_.trades24h -gt 0 }).Count
    lastTradeWithin1h=@($rows | Where-Object { $_.lastTradeAt -gt 0 -and ($asOf.ToUnixTimeSeconds()-$_.lastTradeAt) -le 3600 }).Count
    volume24hUsd=Sum-Field $rows 'volume24hUsd';fees24hUsd=Sum-Field $rows 'fees24hUsd'
    allTimeFeesUsd=Sum-Field $rows 'allTime.feesUsd';allTimePaidUsd=Sum-Field $rows 'allTime.paidUsd'
    ledger24hClaimedUsd=Sum-Field $rows 'ledger24h.claimedUsd';ledger24hPaidUsd=Sum-Field $rows 'ledger24h.paidUsd'
  }
}
$ageRows=foreach($row in $dedup){
  $age=($asOf.ToUnixTimeSeconds()-$row.createdAt)/3600
  $bin=if($age -le 6){'00-06h'}elseif($age -le 12){'06-12h'}elseif($age -le 24){'12-24h'}elseif($age -le 48){'24-48h'}else{'48h+'}
  [pscustomobject]@{mint=$row.mint;pool=$row.pool;dammPool=$row.dammPool;symbol=$row.symbol;createdAtUtc=[DateTimeOffset]::FromUnixTimeSeconds($row.createdAt).ToString('o');ageHours=[Math]::Round($age,5);ageBin=$bin;mode=$row.mode;quote=$row.quoteTicker;marketCapUsd=$row.marketCapUsd;volume24hUsd=$row.volume24hUsd;trades24h=$row.trades24h;graduated=$row.graduated;suspect=$row.suspect;lastTradeAt=$row.lastTradeAt;fees24hUsd=$row.fees24hUsd;allTimeFeesUsd=$row.allTime.feesUsd;allTimePaidUsd=$row.allTime.paidUsd}
}
$duplicates=foreach($group in ($groups | Where-Object Count -gt 1)){
  $allProps=@($group.Group[0].PSObject.Properties.Name)
  $different=foreach($prop in $allProps){$values=@($group.Group | ForEach-Object { $_.$prop | ConvertTo-Json -Depth 10 -Compress });if(@($values | Select-Object -Unique).Count -gt 1){$prop}}
  [pscustomobject]@{mint=$group.Name;count=$group.Count;pools=@($group.Group.pool);createdAt=@($group.Group.createdAt);differentProperties=@($different);rows=@($group.Group | Select-Object mint,pool,dammPool,symbol,createdAt,signature,marketCapUsd,graduated,suspect,volume24hUsd,fees24hUsd,allTime)}
}
$byAge=foreach($group in ($ageRows | Group-Object ageBin | Sort-Object Name)){
  $mints=@($group.Group.mint)
  [pscustomobject]@{ageBin=$group.Name;stats=Describe @($dedup | Where-Object { $mints -ccontains $_.mint })}
}
$byMode=foreach($group in ($dedup | Group-Object mode | Sort-Object Count -Descending)){
  [pscustomobject]@{mode=$group.Name;stats=Describe @($group.Group)}
}
$clean=@($dedup | Where-Object { -not $_.suspect })
$orderedVolume=@($clean | Sort-Object volume24hUsd -Descending)
$volumeTotal=Sum-Field $clean 'volume24hUsd'
$concentration=foreach($n in @(1,3,5,10,25)){
  $selected=@($orderedVolume | Select-Object -First $n)
  [pscustomobject]@{n=$n;volume24hUsd=Sum-Field $selected 'volume24hUsd';sharePct=100*(Sum-Field $selected 'volume24hUsd')/$volumeTotal;symbols=@($selected.symbol)}
}
$byKindSum=0.0;foreach($prop in $source.totals.byKindUsd.PSObject.Properties){$byKindSum += [double]$prop.Value}
$main=$dedup | Where-Object mint -CEQ '5dvXTZ5qwgafnHtwu3Ls3QrWx1U4LQsFeCuJgkk4QEC6'
$feeBody=$feeCapture.body
$result=[pscustomobject]@{
  source='markets.json';asOfAgeReference=$asOf.ToString('o');captureNote='Root captured markets around06:45UTC; exact time is not encoded in raw body.'
  dedupRule='Case-sensitive mint, latest createdAt retained; duplicate records retained separately.'
  raw=Describe @($source.markets);unique=Describe $dedup;nonSuspect=Describe $clean;duplicates=@($duplicates)
  uniquePools=@($dedup | Group-Object pool -CaseSensitive).Count;byAge=@($byAge);byMode=@($byMode)
  oldestCreatedAt=($ageRows | Sort-Object createdAtUtc | Select-Object -First 1).createdAtUtc
  newestCreatedAt=($ageRows | Sort-Object createdAtUtc -Descending | Select-Object -First 1).createdAtUtc
  topVolumeConcentration=@($concentration);topVolume=@($orderedVolume | Select-Object -First 12 symbol,mint,pool,dammPool,mode,createdAt,graduated,marketCapUsd,volume24hUsd,trades24h)
  sourceTotals=$source.totals;sourceByKindSumUsd=$byKindSum;sourceByKindMinusPaidUsd=$byKindSum-$source.totals.paidUsd
  main=[pscustomobject]@{mint=$main.mint;feeBps=$main.feeBps;graduated=$main.graduated;allTime=$main.allTime;volume24hUsd=$main.volume24hUsd;fees24hUsd=$main.fees24hUsd;ledger24h=$main.ledger24h;allTimeFeesToVolumeRatio=$main.allTime.feesUsd/$main.allTime.volumeUsd;fees24hToVolumeRatio=$main.fees24hUsd/$main.volume24hUsd;ledger24hClaimedToFeesRatio=$main.ledger24h.claimedUsd/$main.fees24hUsd}
  feesEndpoint=[pscustomobject]@{url=$feeCapture.url;capturedAt=$feeCapture.capturedAt;feeSource=$feeBody.feeSource;taxBps=$feeBody.taxBps;creatorOnChainBps=$feeBody.creatorOnChainBps;platformAccrued=$feeBody.platformAccrued;platformAccruedUsd=$feeBody.platformAccruedUsd;claimedByPlatform=$feeBody.claimedByPlatform;paidToCreator=$feeBody.paidToCreator;paidToCreatorUsd=$feeBody.paidToCreatorUsd;payoutRows=@($feeBody.payouts).Count}
}
$result | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cohort-calculations.json') -Encoding utf8
$ageRows | Export-Csv -NoTypeInformation -LiteralPath (Join-Path $PSScriptRoot 'cohort-deduplicated.csv') -Encoding utf8
$result | Select-Object raw,unique,nonSuspect,duplicates,byAge,byMode,topVolumeConcentration,sourceByKindSumUsd,sourceByKindMinusPaidUsd,main,feesEndpoint | ConvertTo-Json -Depth 10
