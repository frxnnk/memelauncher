$ErrorActionPreference='Stop'
$sales=Get-Content (Join-Path $PSScriptRoot 'sales-matched.json') -Raw | ConvertFrom-Json -AsHashtable
$rows=@()
foreach($sale in $sales | Where-Object feeMatch){
  $url='https://robinhoodchain.blockscout.com/api?module=account&action=txlistinternal&txhash='+$sale.tx
  try{
    $data=Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 30
    $rows+=@{tx=$sale.tx;claim=$sale.claim;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=$data}
  }catch{$rows+=@{tx=$sale.tx;claim=$sale.claim;url=$url;error=$_.Exception.Message}}
  $rows | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $PSScriptRoot 'sale-internal-transfers.json')
  Start-Sleep -Milliseconds 550
}
@{fetched=$rows.Count;errors=@($rows | Where-Object error).Count} | ConvertTo-Json
