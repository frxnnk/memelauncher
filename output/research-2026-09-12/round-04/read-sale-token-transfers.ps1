$ErrorActionPreference = 'Stop'
$reviewSales = Get-Content -Raw -LiteralPath output/research-2026-09-12/round-03/fees/sales-final.json | ConvertFrom-Json -DateKind String
$reviewTxs = Get-Content -Raw -LiteralPath output/research-2026-09-12/round-03/fees/sale-transactions.json | ConvertFrom-Json -DateKind String
$reviewHashes = @($reviewSales.rows.tx)
$reviewTargets = @($reviewTxs | Where-Object { $_.data.hash -in $reviewHashes -and $_.data.token_transfers_overflow })
$reviewPages = [System.Collections.Generic.List[object]]::new()
foreach ($reviewTarget in $reviewTargets) {
  $reviewBase = 'https://robinhoodchain.blockscout.com/api/v2/transactions/' + $reviewTarget.data.hash + '/token-transfers'
  $reviewUrl = $reviewBase
  for ($reviewPage = 1; $reviewPage -le 4; $reviewPage++) {
    try {
      $reviewData = Invoke-RestMethod -Method Get -Uri $reviewUrl -TimeoutSec 20
      $reviewPages.Add([pscustomobject]@{ tx=$reviewTarget.data.hash; page=$reviewPage; url=$reviewUrl; capturedAt=[DateTime]::UtcNow.ToString('o'); data=$reviewData })
      $reviewPages | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath output/research-2026-09-12/round-04/sale-token-transfer-pages.json -Encoding utf8
      if ($null -eq $reviewData.next_page_params) { break }
      $reviewQuery = ($reviewData.next_page_params.PSObject.Properties | ForEach-Object { [uri]::EscapeDataString($_.Name) + '=' + [uri]::EscapeDataString([string]$_.Value) }) -join '&'
      $reviewUrl = $reviewBase + '?' + $reviewQuery
    } catch {
      $reviewPages.Add([pscustomobject]@{ tx=$reviewTarget.data.hash; page=$reviewPage; url=$reviewUrl; capturedAt=[DateTime]::UtcNow.ToString('o'); error=$_.Exception.Message })
      $reviewPages | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath output/research-2026-09-12/round-04/sale-token-transfer-pages.json -Encoding utf8
      break
    }
  }
}
$reviewPages | ForEach-Object { [pscustomobject]@{ tx=$_.tx; page=$_.page; count=$_.data.items.Count; next=($null -ne $_.data.next_page_params); error=$_.error } } | ConvertTo-Json -Depth 5
