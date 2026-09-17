import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sample = json.loads((ROOT / 'sample.json').read_text(encoding='utf-8'))
result = []
for coin in sample:
    pools = json.loads((ROOT / f'dex-{coin["n"]}.json').read_text(encoding='utf-8-sig'))
    pools = [p for p in pools if p['baseToken']['address'] == coin['mint'] or p['quoteToken']['address'] == coin['mint']]
    ranked = sorted(pools, key=lambda p: (-(p.get('volume', {}).get('h1') or 0), -(p.get('liquidity', {}).get('usd') or 0), p['pairAddress']))
    detail = json.loads((ROOT / f'coin-{coin["n"]}.json').read_text(encoding='utf-8'))[0]
    compact_pools = [{
        'url': p['url'], 'dex': p['dexId'], 'pair': p['pairAddress'], 'base': p['baseToken'], 'quote': p['quoteToken'],
        'createdAt': p.get('pairCreatedAt'), 'mcUsd': p.get('marketCap'),
        'liquidityUsd': p.get('liquidity', {}).get('usd'),
        'h1VolumeUsd': p.get('volume', {}).get('h1'), 'h24VolumeUsd': p.get('volume', {}).get('h24'),
        'h1Txns': p.get('txns', {}).get('h1'), 'h24Txns': p.get('txns', {}).get('h24'),
    } for p in ranked]
    result.append({'coin': coin, 'pools': compact_pools, 'detailAt': detail['at'], 'paid': detail['paid'], 'dropped': detail['dropped'], 'history': detail['history'], 'claims': detail['claims']})
(ROOT / 'sample-summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
for r in result:
    p = r['pools'][0] if r['pools'] else {}
    print(json.dumps({'n': r['coin']['n'], 'symbol': r['coin']['symbol'], 'payoutsList': r['coin']['payouts'], 'age': round(r['coin']['ageHours'], 2), 'poolCount': len(r['pools']), 'dex': p.get('dex'), 'mc':p.get('mcUsd'), 'liq':p.get('liquidityUsd'), 'vol1h':p.get('h1VolumeUsd'), 'vol24':p.get('h24VolumeUsd'), 'txns1h':p.get('h1Txns'), 'paid':r['paid'], 'dropped':r['dropped']}, ensure_ascii=False))
