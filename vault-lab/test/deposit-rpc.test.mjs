import test from 'node:test';
import assert from 'node:assert/strict';
import { createDepositReader, reconcileDepositFromRpc } from '../server/economy/deposit-rpc.mjs';
import { createDepositOrders } from '../server/economy/deposit-orders.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';

const addr = n => '0x' + n.repeat(40), hash = n => '0x' + n.repeat(64);
const asset = { chainId:'1337', tokenAddress:addr('1'), destination:addr('3'), decimals:18, minimumConfirmations:3, standardTransferVerified:true };
const principal = { authenticated:true, accountId:'player_test', walletOwnershipVerified:true, wallets:[{ address:addr('2'), chainType:'ethereum' }] };
const tx = { transactionHash:hash('a'), logIndex:'0x0' };
const receipt = { transactionHash:hash('a'), blockHash:hash('b'), blockNumber:'0x64', status:'0x1', logs:[{
  ...tx, address:addr('1'), blockHash:hash('b'), blockNumber:'0x64', removed:false,
  topics:[TRANSFER_TOPIC, '0x' + '0'.repeat(24) + addr('2').slice(2), '0x' + '0'.repeat(24) + addr('3').slice(2)],
  data:'0x' + (1000n).toString(16).padStart(64,'0') }] };
function setup(overrides = {}, config = {}) {
  const calls = [];
  const reader = createDepositReader({ rpcUrl:'https://fixture.invalid/rpc?key=secret-rpc-key', expectedChainId:'1337', ...config,
    fetchImpl:async (url, init) => {
      assert.equal(init.redirect, 'error'); const body = JSON.parse(init.body); calls.push(body);
      const defaults = { eth_chainId:'0x539', eth_blockNumber:'0x66', eth_getTransactionReceipt:receipt, eth_getBlockByNumber:{ number:'0x64', hash:hash('b') } };
      const result = Object.hasOwn(overrides, body.method) ? overrides[body.method] : defaults[body.method];
      return Response.json({ jsonrpc:'2.0', id:body.id, result });
    } });
  return { reader, calls };
}

test('read-only RPC reconciles a stored owner-bound order without crediting a balance', async t => {
  const orders = createDepositOrders({ asset }); t.after(orders.close);
  const order = orders.create({ key:'order', owner:addr('2'), minimumReceived:'1000' }, principal, { chainHead:'0x63' });
  orders.attach(order.id, principal, tx); const f = setup();
  const result = await reconcileDepositFromRpc({ orders, reader:f.reader, orderId:order.id, principal });
  assert.equal(result.status, 'verified-rpc-evidence'); assert.equal(result.credited, false);
  assert.deepEqual(f.calls.map(c => c.method).sort(), ['eth_blockNumber', 'eth_chainId', 'eth_getBlockByNumber', 'eth_getTransactionReceipt'].sort());
  assert.equal(new Set(f.calls.map(c => c.id)).size, 4);
  assert.deepEqual(f.calls.find(c => c.method === 'eth_getBlockByNumber').params, ['0x64', false]);
  const before = f.calls.length;
  await assert.rejects(reconcileDepositFromRpc({ orders, reader:f.reader, orderId:order.id, principal:{ ...principal, accountId:'player_other' } }), /not found/);
  assert.equal(f.calls.length, before);
});

test('wrong network stops immediately; pending receipt and reorg are not treated as deposits', async t => {
  const wrong = setup({ eth_chainId:'0x1' });
  await assert.rejects(wrong.reader.evidence(tx), /network/); assert.equal(wrong.calls.length, 1);
  const pending = setup({ eth_getTransactionReceipt:null });
  assert.equal((await pending.reader.evidence(tx)).receipt, null); assert.equal(pending.calls.length, 2);
  const orders = createDepositOrders({ asset }); t.after(orders.close);
  const order = orders.create({ key:'reorg', owner:addr('2'), minimumReceived:'1000' }, principal, { chainHead:'0x63' }); orders.attach(order.id, principal, tx);
  const reorg = setup({ eth_getBlockByNumber:{ number:'0x64', hash:hash('c') } });
  await assert.rejects(reconcileDepositFromRpc({ orders, reader:reorg.reader, orderId:order.id, principal }), /canonical/);
});

test('RPC errors, ID substitutions, malformed JSON and oversized responses fail closed without leaking the URL', async () => {
  for (const response of [
    body => Response.json({ jsonrpc:'2.0', id:'someone-else', result:'0x539' }),
    body => Response.json({ jsonrpc:'2.0', id:body.id, error:{ message:'secret-rpc-key' } }),
    body => Response.json([{ jsonrpc:'2.0', id:body.id, result:'0x539' }]),
    () => new Response('not-json'), () => new Response('x'.repeat(512)),
    () => new Response('secret-rpc-key', { status:302, headers:{ location:'https://elsewhere.invalid' } })
  ]) {
    const reader = createDepositReader({ rpcUrl:'https://fixture.invalid/secret-rpc-key', expectedChainId:'1337', maxBytes:256,
      fetchImpl:async (_, init) => response(JSON.parse(init.body)) });
    await assert.rejects(reader.head(), error => /RPC evidence/.test(error.message) && !error.message.includes('secret-rpc-key'));
  }
});

test('RPC timeout aborts transport and exposes no arbitrary signing or broadcast method', async () => {
  let signal;
  const reader = createDepositReader({ rpcUrl:'https://fixture.invalid', expectedChainId:'1337', timeoutMs:10,
    fetchImpl:async (_, init) => { signal = init.signal; return new Promise(() => {}); } });
  await assert.rejects(reader.head(), /unavailable/); assert.equal(signal.aborted, true);
  assert.deepEqual(Object.keys(reader).sort(), ['evidence', 'head', 'inboundTransfers']);
  assert.throws(() => createDepositReader({ rpcUrl:'http://fixture.invalid', expectedChainId:'1337' }), /HTTPS/);
});

test('inbound transfer logs watch any sender to the treasury, never a hardcoded payer topic', async () => {
  const sender = addr('a');
  const payer = addr('6');
  const log = {
    transactionHash: hash('d'), logIndex: '0x0', address: addr('1'), blockHash: hash('b'), blockNumber: '0x64',
    removed: false,
    topics: [TRANSFER_TOPIC, '0x' + sender.slice(2).padStart(64, '0'), '0x' + addr('3').slice(2).padStart(64, '0')],
    data: '0x' + (10n ** 18n).toString(16).padStart(64, '0')
  };
  const f = setup({ eth_getLogs: [log] }, { asset });
  const items = await f.reader.inboundTransfers({ fromBlock: '0x1', toBlock: '0x66' });
  const logsCall = f.calls.find(call => call.method === 'eth_getLogs');
  assert.deepEqual(logsCall.params[0].topics, [
    TRANSFER_TOPIC,
    null,
    '0x' + addr('3').slice(2).padStart(64, '0')
  ]);
  assert.notEqual(logsCall.params[0].topics[1], '0x' + payer.slice(2).padStart(64, '0'));
  assert.equal(items.length, 1);
  assert.equal(items[0].owner, sender);
  assert.equal(items[0].amount, String(10n ** 18n));
  assert.notEqual(items[0].owner, payer);
});
