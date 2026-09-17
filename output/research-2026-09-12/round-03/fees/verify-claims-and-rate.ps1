$ErrorActionPreference='Stop'
$ledger=Get-Content (Join-Path $PSScriptRoot 'fee-ledger.json') -Raw | ConvertFrom-Json -AsHashtable
$claims=Get-Content (Join-Path $PSScriptRoot 'claim-transactions.json') -Raw | ConvertFrom-Json -AsHashtable
$checks=@();[decimal]$gas=0
foreach($row in $claims){
  $tx=$row.data;$release=@($ledger.ledger | Where-Object {$_.tx -eq $tx.hash -and $_.event -eq 'Release'})
  $out=@($tx.token_transfers | Where-Object {$_.from.hash -eq '0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544' -and $_.to.hash -eq '0x79B069112DF103f28bE2012a52eCEF0F4a5106F2'})
  $match=$true
  foreach($event in $release | Where-Object token0Raw -ne '0'){
    $a=@($out | Where-Object {$_.token.address_hash -eq '0xd6FDE6a3Fc6Ab2d83b2BE58383944CA1baDe1E18'})
    $b=@($out | Where-Object {$_.token.address_hash -eq '0xfe09Fb328bE1c286B4f597eD34764b7472ae72c5'})
    if($a.Count -ne 1 -or $b.Count -ne 1 -or $a[0].total.value -ne $event.token0Raw -or $b[0].total.value -ne $event.token1Raw){$match=$false}
  }
  $fee=[decimal]$tx.fee.value/1000000000000000000d
  if($tx.method -eq 'collectFees'){$gas+=$fee}
  $checks+=@{tx=$tx.hash;timestamp=$tx.timestamp;method=$tx.method;status=$tx.status;from=$tx.from.hash;to=$tx.to.hash;decoded=$tx.decoded_input;feeEth=$fee;feeRaw=$tx.fee.value;feeType=$tx.fee.type;releaseMatchesTransfers=$match;transferCount=$tx.token_transfers.Count;overflow=$tx.token_transfers_overflow}
}
$proofs=Get-Content (Join-Path $PSScriptRoot 'swap-transfer-proofs.json') -Raw | ConvertFrom-Json -AsHashtable
$rates=@()
foreach($row in $proofs | Where-Object url -match '/logs$'){
  $swaps=@();$trans=@()
  foreach($log in $row.data.items){
    $p=@{};foreach($param in $log.decoded.parameters){$p[$param.name]=$param.value}
    if($log.decoded.method_call -match '^Swap\(bytes32' -and $p.id -in @($ledger.schedules.pool)){$swaps+=@{index=$log.index;pool=$p.id;sender=$p.sender;amount0=$p.amount0;amount1=$p.amount1;lpFee=$p.fee}}
    if($log.decoded.method_call -match '^Transfer' -and $p.to -in @('0x6f02324d20CC679d0E585290CAa6b16baCbC0F77','0x92d435C96E63c43E12d6D0AB28f6b0B04072F765')){$trans+=@{index=$log.index;token=$log.address.hash;from=$p.from;to=$p.to;amount=if($p.amount){$p.amount}else{$p.value}}}
  }
  $initial=$swaps | Where-Object sender -eq '0x65050A9b7E5075A2bA5cED7b1b64EE66262c40Dc' | Select-Object -First 1
  $feeTransfer=$trans | Where-Object {$_.to -eq '0x6f02324d20CC679d0E585290CAa6b16baCbC0F77'} | Select-Object -First 1
  $gross=if([decimal]$initial.amount0 -gt 0){[decimal]$initial.amount0}else{[decimal]$initial.amount1}
  $rates+=@{url=$row.url;pool=$initial.pool;grossOutputRaw=$gross.ToString();hookTransferRaw=$feeTransfer.amount;observedHookRate=[decimal]$feeTransfer.amount/$gross;lpFee=$initial.lpFee;swaps=$swaps;transfers=$trans}
}
@{checks=$checks;allReleaseTransferMatches=(@($checks | Where-Object {!$_.releaseMatchesTransfers}).Count -eq 0);claimsGasEth=$gas;rateProofs=$rates} | ConvertTo-Json -Depth 18 | Set-Content (Join-Path $PSScriptRoot 'verified-claims-and-rate.json')
@{allMatch=(@($checks | Where-Object {!$_.releaseMatchesTransfers}).Count -eq 0);claimsGasEth=$gas;observedHookRates=@($rates.observedHookRate)} | ConvertTo-Json
