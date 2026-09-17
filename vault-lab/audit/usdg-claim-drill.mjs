import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRoundEscrow, USDG_MAINNET } from '../server/economy/round-escrow.mjs';

const winner = '0x2222222222222222222222222222222222222222';
const escrow = createRoundEscrow({
  asset: USDG_MAINNET, roundId: 'usdg-1-unit-drill', manifestHash: 'e'.repeat(64),
  seedAmount: '1000000', mode: 'fixture-drill'
});
escrow.freezeAttempt({ attemptId: 'd1', recipient: winner, maxPrice: '1000000', inputHash: 'f'.repeat(64) });
escrow.resolve({ attemptId: 'd1', resultHash: 'c'.repeat(64), decision: 'released' });
const paid = escrow.executeFixtureClaim({ attemptId: 'd1', transactionHash: '0x' + '1'.repeat(64) });
let broadcastError;
try { escrow.broadcastMainnet(); } catch (error) { broadcastError = error.message; }
const report = {
  generatedAt: new Date().toISOString(),
  drill: '1-USDG-fixture-claim', realFundsEnabled: false, broadcast: false,
  chainId: USDG_MAINNET.chainId, tokenAddress: USDG_MAINNET.tokenAddress, decimals: USDG_MAINNET.decimals,
  seedAmount: '1000000', payable: paid.amount, continuity: paid.continuity, recipient: paid.recipient,
  transactionHash: paid.transactionHash, unsignedTransfer: paid.transfer?.transaction ?? null,
  mainnetBroadcastRefused: broadcastError,
  note: 'Fixture only. Encodes an unsigned 0.75 USDG transfer. Does not send 1 USDG on Robinhood mainnet 4663 and does not seed $500.'
};
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(join(root, 'output'), { recursive: true });
const out = join(root, 'output', 'usdg-claim-drill.json');
await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, out, payable: paid.amount, broadcast: false }, null, 2));
