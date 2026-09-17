param([string]$OutputName='ranking-first')
$ErrorActionPreference='Stop'
$selection=Import-Csv -LiteralPath (Join-Path $PSScriptRoot 'ranking-input.csv')
$captures=foreach($chain in @('base','bsc')) {
  $rows=@($selection | Where-Object chain -eq $chain)
  $url='https://api.dexscreener.com/latest/dex/pairs/'+$chain+'/'+(($rows.pair)-join ',')
  $at=[DateTime]::UtcNow.ToString('o')
  try {
    $data=Invoke-RestMethod -Uri $url -TimeoutSec 30
    [pscustomobject]@{chain=$chain;requestedAt=$at;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=$data;error=$null}
  } catch {
    [pscustomobject]@{chain=$chain;requestedAt=$at;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=$null;error=$_.Exception.Message}
  }
}
$captures | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $PSScriptRoot ($OutputName+'.json'))
$summary=foreach($row in $selection){
  $capture=$captures | Where-Object chain -eq $row.chain | Select-Object -First 1
  $pair=$capture.data.pairs | Where-Object { $_.pairAddress -eq $row.pair } | Select-Object -First 1
  $created=if($pair.pairCreatedAt){[DateTimeOffset]::FromUnixTimeMilliseconds($pair.pairCreatedAt).UtcDateTime}else{$null}
  $age=if($created){[Math]::Round((([DateTimeOffset]$capture.capturedAt).ToUnixTimeMilliseconds()-$pair.pairCreatedAt)/3600000,3)}else{$null}
  [pscustomobject]@{chain=$row.chain;rank=[int]$row.rank;pair=$row.pair;token=$pair.baseToken.address;name=$pair.baseToken.name;symbol=$pair.baseToken.symbol;quote=$pair.quoteToken.symbol;quoteAddress=$pair.quoteToken.address;uiAge=$row.uiAge;createdAt=$created;ageHours=$age;priceUsd=$pair.priceUsd;marketCap=$pair.marketCap;liquidityUsd=$pair.liquidity.usd;volumeH1=$pair.volume.h1;volumeH6=$pair.volume.h6;volumeH24=$pair.volume.h24;buysH1=$pair.txns.h1.buys;sellsH1=$pair.txns.h1.sells;changeH1=$pair.priceChange.h1;changeH6=$pair.priceChange.h6;boosts=$pair.boosts.active;websites=$pair.info.websites;socials=$pair.info.socials;capturedAt=$capture.capturedAt;error=$capture.error}
}
$summary | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $PSScriptRoot ($OutputName+'-summary.json'))
$summary | Export-Csv -NoTypeInformation -LiteralPath (Join-Path $PSScriptRoot ($OutputName+'-summary.csv'))
$summary | Where-Object { $null -eq $_.ageHours -or $_.ageHours -le 24 } | ConvertTo-Json -Depth 8
