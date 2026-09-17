$ErrorActionPreference='Stop'
function HexInt([string]$hex) { return [System.Numerics.BigInteger]::Parse('0'+($hex -replace '^0x',''),[System.Globalization.NumberStyles]::HexNumber) }
function Word([string]$data,[int]$i){ return $data.Substring(2+64*$i,64) }
$raw=Get-Content (Join-Path $PSScriptRoot 'fee-event-pages.json') -Raw | ConvertFrom-Json -AsHashtable
$pools=@{CATGPT='0x086f510359ad57e4f8588b71ffa21fe29bbed044e4d13aa2f72ecaefeda95a36';ANTHROPIG_LONG='0xaf28b153a45c4647ed76860811f734152e3c93e29c6a4489691954b71716d310'}
$ledger=@();$rotations=@();$schedules=@()
foreach($page in $raw){ foreach($event in $page.data.result){
  $common=@{label=$page.label;event=$page.event;tx=$event.transactionHash;logIndex=[int](HexInt $event.logIndex);block=[int](HexInt $event.blockNumber);timestamp=[DateTimeOffset]::FromUnixTimeSeconds([long](HexInt $event.timeStamp)).ToString('o')}
  if($page.event -in @('Collect','Release')) {
    $common.pool=$event.topics[1];$common.token0Raw=(HexInt (Word $event.data 0)).ToString();$common.token1Raw=(HexInt (Word $event.data 1)).ToString()
    $common.token0=[decimal]$common.token0Raw/1000000000000000000d;$common.token1=[decimal]$common.token1Raw/1000000000000000000d
    $common.recipient=if($page.event -eq 'Release'){'0x'+$event.topics[2].Substring(26)}else{$null}
    $ledger+=$common
  } elseif($page.event -eq 'UpdateBeneficiary') {
    $pool='0x'+(Word $event.data 0);$label=@($pools.Keys | Where-Object {$pools[$_] -eq $pool})
    if($label.Count){$common.label=$label[0];$common.pool=$pool;$common.old='0x'+(Word $event.data 1).Substring(24);$common.new='0x'+(Word $event.data 2).Substring(24);$rotations+=$common}
  } elseif($page.event -eq 'FeeScheduleSet') {
    $common.pool=$event.topics[1];$common.start=[long](HexInt (Word $event.data 0));$common.startFee=[int](HexInt (Word $event.data 1));$common.endFee=[int](HexInt (Word $event.data 2));$common.duration=[int](HexInt (Word $event.data 3));$schedules+=$common
  }
} }
$summary=@($ledger | Group-Object label,event,recipient | ForEach-Object {$g=$_.Group; [decimal]$sum0=0;[decimal]$sum1=0;foreach($i in $g){$sum0+=$i.token0;$sum1+=$i.token1};@{label=$g[0].label;event=$g[0].event;recipient=$g[0].recipient;count=$g.Count;token0=$sum0;token1=$sum1;first=($g | Sort-Object timestamp | Select-Object -First 1).timestamp;last=($g | Sort-Object timestamp | Select-Object -Last 1).timestamp}})
$create=Get-Content (Join-Path $PSScriptRoot '../../deep/forensics/creation-and-reads.json') -Raw | ConvertFrom-Json -AsHashtable
$configs=@()
foreach($row in $create | Where-Object url -match '/transactions/0x(fba|24b)'){
  $values=$row.data.decoded_input.parameters[0].value;$data=$values[8];$structOffset=[int](HexInt (Word $data 0));$struct='0x'+$data.Substring(2+$structOffset*2)
  $hookOffset=[int](HexInt (Word $struct 6));$hookLength=[int](HexInt (Word $struct ($hookOffset/32)));$hook='0x'+$struct.Substring(2+($hookOffset+32)*2,$hookLength*2)
  $fields=@();for($i=0;$i -lt $hookLength/32;$i++){$fields+=('0x'+(Word $hook $i))}
  $configs+=@{tx=$row.data.hash;asset=$row.data.decoded_input.parameters[1].value[2];lpFee=[int](HexInt (Word $struct 0));hook='0x'+(Word $struct 5).Substring(24);numeraire='0x'+(Word $hook 0).Substring(24);buybackDst='0x'+(Word $hook 1).Substring(24);startFee=[int](HexInt (Word $hook 2));endFee=[int](HexInt (Word $hook 3));duration=[int](HexInt (Word $hook 4));start=[int](HexInt (Word $hook 5));routingMode=[int](HexInt (Word $hook 6));matrix=@(7..14 | ForEach-Object {(HexInt (Word $hook $_)).ToString()});rawFields=$fields}
}
@{cutBlock=60871576;cutUtc='2026-09-12T05:52:06Z';ledger=$ledger;summary=$summary;rotations=$rotations;schedules=$schedules;configs=$configs} | ConvertTo-Json -Depth 18 | Set-Content (Join-Path $PSScriptRoot 'fee-ledger.json')
@{summary=$summary;rotations=$rotations;configs=$configs} | ConvertTo-Json -Depth 12
