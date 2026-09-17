param([string]$OutputName='ranking-first')
$ErrorActionPreference='Stop'
$selection=Import-Csv -LiteralPath (Join-Path $PSScriptRoot 'ranking-input.csv')
$url='https://api.dexscreener.com/latest/dex/pairs/solana/'+(($selection.pair)-join ',')
$requestedAt=[DateTime]::UtcNow.ToString('o')
$data=Invoke-RestMethod -Uri $url -TimeoutSec 30
$capturedAt=[DateTime]::UtcNow.ToString('o')
$capture=[pscustomobject]@{uiCapturedAt='2026-09-12T06:33:57.805Z';rankBy='Trending 6H';tableInterval='Last 24 hours';requestedAt=$requestedAt;capturedAt=$capturedAt;url=$url;data=$data}
$capture | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $PSScriptRoot ($OutputName+'.json'))
$summary=foreach($row in $selection){
  $pair=$data.pairs | Where-Object { $_.pairAddress -eq $row.pair } | Select-Object -First 1
  $created=if($pair.pairCreatedAt){[DateTimeOffset]::FromUnixTimeMilliseconds($pair.pairCreatedAt).UtcDateTime}else{$null}
  $age=if($created){[Math]::Round((([DateTimeOffset]$capturedAt).ToUnixTimeMilliseconds()-$pair.pairCreatedAt)/3600000,3)}else{$null}
  [pscustomobject]@{chain='solana';rank=[int]$row.rank;pair=$pair.pairAddress;requestedPair=$row.pair;matched=($null -ne $pair);token=$pair.baseToken.address;name=$pair.baseToken.name;symbol=$pair.baseToken.symbol;quote=$pair.quoteToken.symbol;quoteAddress=$pair.quoteToken.address;uiAge=$row.uiAge;createdAt=$created;ageHours=$age;priceUsd=$pair.priceUsd;marketCap=$pair.marketCap;liquidityUsd=$pair.liquidity.usd;volumeH1=$pair.volume.h1;volumeH6=$pair.volume.h6;volumeH24=$pair.volume.h24;buysH1=$pair.txns.h1.buys;sellsH1=$pair.txns.h1.sells;changeH1=$pair.priceChange.h1;changeH6=$pair.priceChange.h6;boosts=$pair.boosts.active;websites=$pair.info.websites;socials=$pair.info.socials;capturedAt=$capturedAt}
}
$summary | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $PSScriptRoot ($OutputName+'-summary.json'))
$summary | Export-Csv -NoTypeInformation -LiteralPath (Join-Path $PSScriptRoot ($OutputName+'-summary.csv'))
$summary | Where-Object { $null -eq $_.ageHours -or $_.ageHours -le 13 } | ConvertTo-Json -Depth 8
