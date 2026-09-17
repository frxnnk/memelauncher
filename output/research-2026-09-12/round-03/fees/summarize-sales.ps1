$ErrorActionPreference='Stop'
$sales=Get-Content (Join-Path $PSScriptRoot 'sales-matched.json') -Raw | ConvertFrom-Json -AsHashtable
$txRows=Get-Content (Join-Path $PSScriptRoot 'sale-transactions.json') -Raw | ConvertFrom-Json -AsHashtable
$legacy=Get-Content (Join-Path $PSScriptRoot 'sale-internal-transfers.json') -Raw | ConvertFrom-Json -AsHashtable
$example=Get-Content (Join-Path $PSScriptRoot 'internal-legacy-test.json') -Raw | ConvertFrom-Json -AsHashtable
$v2=Get-Content (Join-Path $PSScriptRoot 'sale-internal-v2-pages.json') -Raw | ConvertFrom-Json -AsHashtable
$receiver='0x79B069112DF103f28bE2012a52eCEF0F4a5106F2'
$feeRecipient='0xB8159Ba378904F803639D274cec79F788931C9C8'
$output=@()
foreach($sale in $sales | Where-Object feeMatch){
  $tx=($txRows | Where-Object {$_.data.hash -eq $sale.tx}).data
  $tokenOut=$tx.token_transfers | Where-Object {$_.from.hash -eq $receiver -and $_.token.symbol -eq $sale.token} | Select-Object -First 1
  $traces=@();$complete=$false
  $l=$legacy | Where-Object {$_.tx -eq $sale.tx -and $_.data.status -eq '1'}
  if($sale.tx -eq '0x1ac3ebba1b720d2587657e740d8f566c785a1064223427d67531458b4ab31f72'){$l=$example}
  if($l){$complete=$true;foreach($trace in $l.data.result){$traces+=@{index=$trace.index;from=$trace.from;to=$trace.to;valueRaw=$trace.value;success=($trace.isError -eq '0');type=$trace.type}}}
  else{
    $pages=@($v2 | Where-Object tx -eq $sale.tx | Sort-Object page)
    if($pages.Count -and !$pages[-1].error -and !$pages[-1].data.next_page_params){$complete=$true}
    foreach($trace in $pages.data.items){$traces+=@{index=$trace.index;from=$trace.from.hash;to=$trace.to.hash;valueRaw=$trace.value;success=$trace.success;type=$trace.type}}
  }
  [decimal]$paid=0;[decimal]$routerFee=0
  foreach($trace in $traces | Where-Object success){if($trace.to -eq $receiver){$paid+=[decimal]$trace.valueRaw/1000000000000000000d};if($trace.to -eq $feeRecipient){$routerFee+=[decimal]$trace.valueRaw/1000000000000000000d}}
  $output+=@{claim=$sale.claim;tx=$sale.tx;timestamp=$sale.timestamp;token=$sale.token;tokenAddress=$tokenOut.token.address_hash;tokenAmountRaw=$tokenOut.total.value;tokenAmount=([decimal]$tokenOut.total.value/1000000000000000000d).ToString();ethReceived=$paid.ToString();routerFeeEth=$routerFee.ToString();gasEth=([decimal]$tx.fee.value/1000000000000000000d).ToString();tracesComplete=$complete;paymentTraces=@($traces | Where-Object {$_.to -in @($receiver,$feeRecipient) -and $_.valueRaw -ne '0'})}
}
[decimal]$totalPaid=0;[decimal]$totalRouterFee=0;[decimal]$totalGas=0
foreach($s in $output){$totalPaid=[decimal]::Add($totalPaid,[decimal]::Parse($s.ethReceived));$totalRouterFee=[decimal]::Add($totalRouterFee,[decimal]::Parse($s.routerFeeEth));$totalGas=[decimal]::Add($totalGas,[decimal]::Parse($s.gasEth))}
$tokens=@($output | Group-Object token | ForEach-Object {[decimal]$sum=0;[decimal]$paid=0;foreach($s in $_.Group){$sum=[decimal]::Add($sum,[decimal]::Parse($s.tokenAmount));$paid=[decimal]::Add($paid,[decimal]::Parse($s.ethReceived))};@{token=$_.Name;count=$_.Count;tokenAmount=$sum.ToString();ethReceived=$paid.ToString()}})
$summary=@{transactions=$output.Count;claims=@($output.claim | Sort-Object -Unique).Count;completeTraces=@($output | Where-Object tracesComplete).Count;tokens=$tokens;ethReceived=$totalPaid.ToString();routerFeeEth=$totalRouterFee.ToString();salesGasEth=$totalGas.ToString();ethReceivedMinusSalesGas=($totalPaid-$totalGas).ToString();scope='Only 19 exact amount matches within 30 seconds of a CATGPT LP Release; not full wallet inventory or profit; all amounts historical token/native units, no USD mark.'}
@{summary=$summary;rows=$output} | ConvertTo-Json -Depth 18 | Set-Content (Join-Path $PSScriptRoot 'sales-final.json')
$summary | ConvertTo-Json -Depth 8
