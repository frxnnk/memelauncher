$ErrorActionPreference='Stop'
$ledger=Get-Content (Join-Path $PSScriptRoot 'fee-ledger.json') -Raw | ConvertFrom-Json -AsHashtable
$hashes=@(@($ledger.ledger.tx)+@($ledger.rotations.tx) | Sort-Object -Unique)
$result=@($hashes | ForEach-Object -ThrottleLimit 4 -Parallel {
  $url='https://robinhoodchain.blockscout.com/api/v2/transactions/'+$_
  try {@{capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=(Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 35)}} catch {@{url=$url;error=$_.Exception.Message}}
})
$result | ConvertTo-Json -Depth 55 | Set-Content (Join-Path $PSScriptRoot 'claim-transactions.json')
$histories=@(@{label='CAT_RECEIVER';address='0x79B069112DF103f28bE2012a52eCEF0F4a5106F2'},@{label='ANTH_BENEFICIARY';address='0x346895802e1AeCB0E4951b3Ee96aA37c2CB368Eb'})
$history=@($histories | ForEach-Object -ThrottleLimit 2 -Parallel {
  $query=$_;$url='https://robinhoodchain.blockscout.com/api/v2/addresses/'+$query.address+'/transactions?filter=from'
  for($page=1;$page -le 10;$page++){
    try {
      $data=(Invoke-WebRequest -Method Get -Uri $url -TimeoutSec 35).Content | ConvertFrom-Json -AsHashtable -DateKind String
      @{label=$query.label;page=$page;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=$data}
      if(!$data.next_page_params -or ($data.items.Count -and [DateTimeOffset]$data.items[-1].timestamp -lt [DateTimeOffset]'2026-09-11T23:40:00Z')){break}
      $params=@($data.next_page_params.GetEnumerator() | ForEach-Object {$_.Key+'='+[Uri]::EscapeDataString([string]$_.Value)}) -join '&'
      $url='https://robinhoodchain.blockscout.com/api/v2/addresses/'+$query.address+'/transactions?'+$params
    }catch{@{label=$query.label;page=$page;url=$url;error=$_.Exception.Message};break}
  }
})
$history | ConvertTo-Json -Depth 55 | Set-Content (Join-Path $PSScriptRoot 'receiver-transaction-pages.json')
@{claims=$result.Count;claimErrors=@($result | Where-Object error).Count;history=@($history | ForEach-Object {@{label=$_.label;page=$_.page;count=$_.data.items.Count;oldest=if($_.data.items){$_.data.items[-1].timestamp}else{$null};hasNext=!!$_.data.next_page_params;error=$_.error}})} | ConvertTo-Json -Depth 10
