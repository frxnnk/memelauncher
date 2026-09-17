$ErrorActionPreference='Stop'
$candidates=Get-Content (Join-Path $PSScriptRoot 'sale-candidates.json') -Raw | ConvertFrom-Json -AsHashtable
$result=@()
foreach($candidate in $candidates){
  $url='https://robinhoodchain.blockscout.com/api/v2/transactions/'+$candidate.tx
  try {
    $data=(Invoke-WebRequest -Method Get -Uri $url -TimeoutSec 30).Content | ConvertFrom-Json -AsHashtable -DateKind String
    $result+=@{claim=$candidate.claim;secondsAfter=$candidate.secondsAfter;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=$data}
  }catch{$result+=@{claim=$candidate.claim;url=$url;error=$_.Exception.Message}}
  Start-Sleep -Milliseconds 350
}
$result | ConvertTo-Json -Depth 55 | Set-Content (Join-Path $PSScriptRoot 'sale-transactions.json')
@{fetched=$result.Count;errors=@($result | Where-Object error).Count} | ConvertTo-Json
