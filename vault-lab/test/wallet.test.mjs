import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createWalletConnection, networkLabel } from '../public/wallet.js';
const ADDRESS = '0x' + '1'.repeat(40);
function setup(response) {
  const target = new EventTarget(), provider = new EventEmitter(), calls = [], states = [];
  provider.request = async input => { calls.push(input); return response ? response(input) : input.method === 'eth_requestAccounts' ? [ADDRESS] : '0x1237'; };
  target.ethereum = provider;
  const wallet = createWalletConnection({ target, onChange: state => states.push(state) });
  return { target, provider, calls, states, wallet };
}
test('wallet discovery never requests accounts, signatures, transfers or a network change', () => {
  const f = setup();
  assert.equal(f.calls.length, 0);
  assert.equal(f.states.at(-1).wallets.length, 1);
  f.wallet.destroy();
});
test('explicit connect requests only accounts and chain; changes and disconnect update state', async () => {
  const f = setup(); await f.wallet.connect('wallet-0');
  assert.deepEqual(f.calls.map(x => x.method), ['eth_requestAccounts', 'eth_chainId']);
  assert.equal(f.wallet.state().address, ADDRESS);
  f.provider.emit('chainChanged', '0xb626');
  assert.equal(f.wallet.state().chainId, '46630');
  assert.match(networkLabel('46630'), /testnet/);
  f.provider.emit('accountsChanged', []);
  assert.equal(f.wallet.state().status, 'disconnected');
  assert.equal(f.provider.listenerCount('accountsChanged'), 0);
  f.wallet.destroy();
});
test('declining access gives a clear error without retaining an account', async () => {
  const f = setup(() => { throw Object.assign(new Error('Rejected'), { code: 4001 }); });
  await f.wallet.connect('wallet-0');
  assert.equal(f.wallet.state().address, null);
  assert.match(f.wallet.state().error, /declined/);
  f.wallet.destroy();
});
test('cancelled connection cannot be revived by a stale provider response', async () => {
  let resolveRequest;
  const f = setup(() => new Promise(resolve => { resolveRequest = resolve; }));
  const pending = f.wallet.connect('wallet-0'); f.wallet.disconnect(); resolveRequest([ADDRESS]); await pending;
  assert.equal(f.wallet.state().status, 'disconnected');
  assert.equal(f.calls.length, 1);
  f.wallet.destroy();
});
test('malformed provider data does not become a connected wallet', async () => {
  const f = setup(input => input.method === 'eth_requestAccounts' ? ['not-an-address'] : '0x1237');
  await f.wallet.connect('wallet-0');
  assert.equal(f.wallet.state().status, 'disconnected');
  assert.equal(f.wallet.state().address, null);
  f.wallet.destroy();
});

test('account and chain events during connection take precedence over stale RPC replies', async () => {
  let finishChain;
  const f = setup(input => input.method === 'eth_requestAccounts' ? [ADDRESS] : new Promise(resolve => { finishChain = resolve; }));
  const pending = f.wallet.connect('wallet-0');
  await Promise.resolve(); await Promise.resolve();
  const changed = '0x' + '2'.repeat(40);
  f.provider.emit('accountsChanged', [changed]); f.provider.emit('chainChanged', '0xb626');
  finishChain('0x1237'); await pending;
  assert.equal(f.wallet.state().address, changed); assert.equal(f.wallet.state().chainId, '46630');
  f.wallet.destroy();
});
