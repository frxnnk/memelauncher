$ErrorActionPreference='Stop'
$outDir=$PSScriptRoot
$base='https://robinhoodchain.blockscout.com/api?module=logs&action=getLogs'
$init='0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544'
$rehype='0x6f02324d20CC679d0E585290CAa6b16baCbC0F77'
$cutBlock=60871576
$queries=@()
foreach ($p in @(
  @{label='CATGPT';pool='0x086f510359ad57e4f8588b71ffa21fe29bbed044e4d13aa2f72ecaefeda95a36';start=60652312},
  @{label='ANTHROPIG_LONG';pool='0xaf28b153a45c4647ed76860811f734152e3c93e29c6a4489691954b71716d310';start=60661247}
)) {
  foreach($event in @(
    @{name='Release';topic='0x951cb665214ddfa483febb22b592b0c67f38eac40f7be33f6fcbbe63289276d1';address=$init},
    @{name='Collect';topic='0xad34f511970a4cac65bf0c3c9cc235ce712b801c0c90c20599ca002c233dcd21';address=$init},
    @{name='FeeScheduleSet';topic='0xcea1bdc74004c2beebf7a8d2d531c3950ca35e8326a55bdc553df9d1b593d7b3';address=$rehype}
  )) {
    $queries += @{label=$p.label;event=$event.name;url="$base&fromBlock=$($p.start)&toBlock=$cutBlock&address=$($event.address)&topic0=$($event.topic)&topic1=$($p.pool)&topic0_1_opr=and"}
  }
}
$queries+=@{label='ALL_FILTER_LOCAL';event='UpdateBeneficiary';url="$base&fromBlock=60652312&toBlock=$cutBlock&address=$init&topic0=0x1cf54f5b8d44449c5e825b10be69352659f801b88a02d8c6dfdb5ddd655be77d"}
$result=@($queries | ForEach-Object -ThrottleLimit 3 -Parallel {
  $q=$_
  for($page=1;$page -le 3;$page++) {
    $url=$q.url+"&page=$page&offset=1000"
    try {
      $data=Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 40
      @{label=$q.label;event=$q.event;page=$page;capturedAt=[DateTime]::UtcNow.ToString('o');url=$url;data=$data}
      if($data.status -ne '1' -or $data.result.Count -lt 1000){break}
    } catch { @{label=$q.label;event=$q.event;page=$page;url=$url;error=$_.Exception.Message};break }
  }
})
$result | ConvertTo-Json -Depth 35 | Set-Content (Join-Path $outDir 'fee-event-pages.json')
$result | ForEach-Object { @{label=$_.label;event=$_.event;page=$_.page;status=$_.data.status;count=$_.data.result.Count;error=$_.error} } | ConvertTo-Json
