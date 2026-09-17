import assert from 'node:assert/strict';
import { accountGameFixture, asset, address, hash } from './account-game.mjs';
import { createDepositReader } from '../../server/economy/deposit-rpc.mjs';
import { createAuthenticatedDeposits } from '../../server/economy/authenticated-deposits.mjs';
import { TRANSFER_TOPIC } from '../../server/economy/deposit.mjs';

export const depositInput = (key = 'deposit', wallet = address('2'), amountBaseUnits = '1000') => ({ key, wallet, amountBaseUnits });
export const transferReceipt = (transactionHash = hash('a'), owner = address('2'), amount = '1000') => ({
  transactionHash, status: '0x1', blockHash: hash('b'), blockNumber: '0x64',
  logs: [{ transactionHash, logIndex: '0x0', address: asset.tokenAddress, blockHash: hash('b'), blockNumber: '0x64', removed: false,
    topics: [TRANSFER_TOPIC, '0x' + owner.slice(2).padStart(64, '0'), '0x' + asset.destination.slice(2).padStart(64, '0')],
    data: '0x' + BigInt(amount).toString(16).padStart(64, '0') }] });

export async function depositFlowFixture() {
  const f = await accountGameFixture(), calls = [], control = { head: '0x63', receipt: null, chain: '0x539', block: { hash: hash('b'), number: '0x64' } };
  const reader = createDepositReader({ rpcUrl: 'https://fixture.invalid/deposit', expectedChainId: asset.chainId,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://fixture.invalid/deposit'); const body = JSON.parse(init.body); calls.push(body);
      if (control.gate) await control.gate;
      if (control.fail) throw new Error('Fixture RPC outage');
      const values = { eth_chainId: control.chain, eth_blockNumber: control.head,
        eth_getTransactionReceipt: control.receipts ? control.receipts[body.params[0]] ?? null : control.receipt, eth_getBlockByNumber: control.block };
      assert.ok(Object.hasOwn(values, body.method), 'No signing or send method is allowed.');
      return Response.json({ jsonrpc: '2.0', id: body.id, result: values[body.method] });
    } });
  const open = () => createAuthenticatedDeposits({ economy: f.economy, authentication: f.authentication, reader });
  let deposits = open();
  return { f, calls, control, reader, get deposits() { return deposits; },
    restart() { f.restart(); deposits = open(); }, close: f.close };
}
