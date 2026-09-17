$ErrorActionPreference = 'Stop'
$allDir = $PSScriptRoot
$sample = Get-Content (Join-Path $allDir 'sample.json') -Raw | ConvertFrom-Json
$requests = foreach ($coin in $sample) {
    [pscustomobject]@{ Name="coin-$($coin.n).html"; Url="https://www.allonsol.fun/coin/$($coin.mint)" }
    [pscustomobject]@{ Name="dex-$($coin.n).json"; Url="https://api.dexscreener.com/token-pairs/v1/solana/$($coin.mint)" }
}
$requests += [pscustomobject]@{Name='rounds.html';Url='https://www.allonsol.fun/rounds'}
$requests += [pscustomobject]@{Name='analytics.html';Url='https://www.allonsol.fun/analytics'}
$results = $requests | ForEach-Object -Parallel {
    $request = $_
    $targetDir = $using:allDir
    $utc = [DateTime]::UtcNow.ToString('o')
    try {
        $response = Invoke-WebRequest -Uri $request.Url -UseBasicParsing -TimeoutSec 25
        $response.Content | Set-Content -LiteralPath (Join-Path $targetDir $request.Name) -Encoding utf8
        [pscustomobject]@{name=$request.Name;url=$request.Url;at=$utc;status=[int]$response.StatusCode;bytes=$response.Content.Length}
    } catch {
        [pscustomobject]@{name=$request.Name;url=$request.Url;at=$utc;error=$_.Exception.Message}
    }
} -ThrottleLimit 4
$results | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $allDir 'fetch-log.json') -Encoding utf8
$results | Format-Table -AutoSize
