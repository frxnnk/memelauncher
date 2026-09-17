$ErrorActionPreference='Stop'
$failed=Get-Content (Join-Path $PSScriptRoot 'sale-internal-transfers.json') -Raw | ConvertFrom-Json -AsHashtable
$rows=@()
foreach($sale in $failed | Where-Object {$_.error -and $_.tx -ne '0x1ac3ebba1b720d2587657e740d8f566c785a1064223427d67531458b4ab31f72'}){
  $base='https://robinhoodchain.blockscout.com/api/v2/transactions/'+$sale.tx+'/internal-transactions'
  $url=$base
  for($page=1;$page -le 3;$page++){
    try{
      $data=(Invoke-WebRequest -Method Get -Uri $url -TimeoutSec 25).Content | ConvertFrom-Json -AsHashtable -DateKind String
      $rows+=@{tx=$sale.tx;claim=$sale.claim;page=$page;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=$data}
      $rows | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $PSScriptRoot 'sale-internal-v2-pages.json')
      if(!$data.next_page_params){break}
      $query=@($data.next_page_params.GetEnumerator() | ForEach-Object {$_.Key+'='+[Uri]::EscapeDataString([string]$_.Value)}) -join '&'
      $url=$base+'?'+$query
      Start-Sleep -Milliseconds 500
    }catch{$rows+=@{tx=$sale.tx;claim=$sale.claim;page=$page;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;error=$_.Exception.Message};break}
  }
  Start-Sleep -Milliseconds 500
}
$rows | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $PSScriptRoot 'sale-internal-v2-pages.json')
@{rows=$rows.Count;transactions=@($rows.tx | Sort-Object -Unique).Count;errors=@($rows | Where-Object error).Count} | ConvertTo-Json
