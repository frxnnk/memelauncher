"""Local read-only replay of two public receipts, no external dependencies.

Checks internal consistency, not historical snapshot truth or prior commitment.
"""
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).parent
MASK = (1 << 64) - 1
RC = [0x1, 0x8082, 0x800000000000808a, 0x8000000080008000,
      0x808b, 0x80000001, 0x8000000080008081, 0x8000000000008009,
      0x8a, 0x88, 0x80008009, 0x8000000a, 0x8000808b,
      0x800000000000008b, 0x8000000000008089, 0x8000000000008003,
      0x8000000000008002, 0x8000000000000080, 0x800a,
      0x800000008000000a, 0x8000000080008081, 0x8000000000008080,
      0x80000001, 0x8000000080008008]
ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
       [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]

def rotate(value, shift):
    return ((value << shift) | (value >> (64 - shift))) & MASK

def keccak(data):
    state = [0] * 25
    padded = bytearray(data) + b'\x01'
    padded.extend(b'\0' * ((136 - len(padded) % 136) % 136))
    padded[-1] |= 0x80
    for start in range(0, len(padded), 136):
        for i in range(17):
            state[i] ^= int.from_bytes(padded[start+i*8:start+i*8+8], 'little')
        for rc in RC:
            c = [state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20] for x in range(5)]
            d = [c[(x-1)%5] ^ rotate(c[(x+1)%5], 1) for x in range(5)]
            a = [state[x+5*y] ^ d[x] for y in range(5) for x in range(5)]
            b = [0]*25
            for x in range(5):
                for y in range(5):
                    b[y+5*((2*x+3*y)%5)] = rotate(a[x+5*y], ROT[x][y])
            state = [b[x+5*y] ^ ((~b[(x+1)%5+5*y]) & b[(x+2)%5+5*y]) for y in range(5) for x in range(5)]
            state[0] ^= rc
    return b''.join(x.to_bytes(8, 'little') for x in state)[:32]

def base58decode(text):
    alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    value = 0
    for char in text:
        value = value * 58 + alphabet.index(char)
    return b'\0' * (len(text)-len(text.lstrip('1'))) + value.to_bytes((value.bit_length()+7)//8, 'big')

assert keccak(b'').hex() == 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
assert keccak(b'abc').hex() == '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45'

results = []
browser_proof = json.loads((ROOT/'raw'/'browser-proof.json').read_text())
for cycle in (197, 198):
    receipt = json.loads((ROOT/'raw'/f'receipt-{cycle}.json').read_text())
    candidates = json.loads((ROOT/'raw'/f'candidates-{cycle}.json').read_text())['candidates']
    rows = sorted(candidates, key=lambda row: row['address'].encode('ascii'))
    payload = '\n'.join(f"{r['address']},{r['balance']},{r['weight']}" for r in rows).encode()
    candidate_hash = keccak(payload)
    seed = keccak(base58decode(receipt['randomness']['entropyBlockhash']) + cycle.to_bytes(32, 'big') + candidate_hash)
    total = sum(r['weight'] for r in rows)
    roll = int.from_bytes(seed, 'big') % total
    cumulative = 0
    for index, row in enumerate(rows):
        cumulative += row['weight']
        if cumulative > roll:
            winner = row
            break
    results.append({
        'cycleId': cycle, 'candidateCount': len(rows), 'uniqueCandidateAddresses': len({r['address'] for r in rows}),
        'candidateHash': '0x'+candidate_hash.hex(), 'hashMatches': '0x'+candidate_hash.hex()==receipt['candidates']['hash'],
        'seed': '0x'+seed.hex(), 'seedMatches': '0x'+seed.hex()==receipt['randomness']['seed'],
        'totalWeight': total, 'weightMatches': total==receipt['candidates']['totalWeight'],
        'roll': roll, 'winnerIndex': index, 'winner': winner, 'winnerMatches': winner['address']==receipt['winner']['address'],
        'weightDistribution': dict(Counter(r['weight'] for r in rows)),
        'winnerProbabilityGivenPublishedList': winner['weight']/total,
        'minProbabilityGivenPublishedList': min(r['weight'] for r in rows)/total,
        'maxProbabilityGivenPublishedList': max(r['weight'] for r in rows)/total,
        'minimumRawBalance': min(int(r['balance']) for r in rows),
        'sameOrderAsPublished': rows==candidates,
        'independentHistoricalBalancesVerified': False,
        'preEntropyCommitmentVerified': False,
        'entropyBlockhashIndependentlyVerified': any(p['cycleId']==cycle and p['entropy_blockhash']==receipt['randomness']['entropyBlockhash'] and p['entropy_slot']==receipt['randomness']['entropySlot'] for p in browser_proof['drops']),
    })
(ROOT/'replay-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
