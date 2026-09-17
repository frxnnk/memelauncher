import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createAuthentication } from '../../server/auth.mjs';
import { createInferenceLimits } from '../../server/limits.mjs';
import { createVaultService } from '../../server/service.mjs';
import { createAssetEconomy } from '../../server/economy/asset-service.mjs';
import { createAuthenticatedCreditGame } from '../../server/economy/authenticated-game.mjs';
import { TRANSFER_TOPIC } from '../../server/economy/deposit.mjs';
import { DEFAULT_GUARDIANS } from '../../server/rounds.mjs';
import { BLOCKRUN_CHAT, BASE_USDC } from '../../server/x402-blockrun.mjs';

export const address = n => '0x' + n.repeat(40), hash = n => '0x' + n.repeat(64);
export const asset = { chainId: '1337', tokenAddress: address('1'), destination: address('3'), decimals: 18,
  minimumConfirmations: 3, standardTransferVerified: true };
export const terms = { price: '100', prizeBps: 7000, operationsBps: 2000 };
export const input = (key = 'message', wallet = address('2')) => ({ key, roundId: 'r1', modelId: DEFAULT_GUARDIANS[0],
  prompt: 'Synthetic guardian argument.', payoutWallet: wallet, creditMode: 'asset-preparation' });
export const completion = (model, tool = 'keep_locked', extraArguments = {}) => ({ model, provider: 'Fixture provider', usage: { cost: 0.001 },
  choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
    tool_calls: [{ id: 'fixture-tool', type: 'function', function: { name: tool, arguments: JSON.stringify({ explanation: 'Fixture response.', ...extraArguments }) } }] } }] });

export async function accountGameFixture(options = {}) {
  const root = resolve(tmpdir()), directory = await mkdtemp(join(root, 'vault-account-game-'));
  assert.ok(resolve(directory).startsWith(root + sep));
  const usedAsset = options.asset ?? asset;
  const roundId = options.roundId ?? 'r1';
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const config = { appId: 'credit-fixture-app', clientId: 'credit-fixture-client', verificationKey: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
  const authentication = createAuthentication(config), calls = [], controls = {};
  const headers = (name = 'alice', wallets = [address(name === 'alice' ? '2' : '4')]) => {
    const now = Math.floor(Date.now() / 1000), claims = { iss: 'privy.io', aud: config.appId,
      sub: 'did:privy:fixture-' + name, sid: 'fixture-' + name, iat: now, exp: now + 300 };
    const token = extras => {
      const encoded = [Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url'),
        Buffer.from(JSON.stringify({ ...claims, ...extras })).toString('base64url')].join('.');
      return encoded + '.' + sign('sha256', Buffer.from(encoded), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    };
    return { authorization: 'Bearer ' + token({}), 'x-privy-identity-token': token({ cr: String(now), guest: 'f', linked_accounts: JSON.stringify(
      wallets.map(wallet => ({ type: 'wallet', wallet_client_type: 'privy', chain_type: 'ethereum', address: wallet, lv: now }))) }) };
  };
  const alice = await authentication.authenticate(headers()), bob = await authentication.authenticate(headers('bob'));
  let economy, vault, limits, game;
  const jobsPath = join(directory, 'jobs.sqlite');
  const closeServices = () => { game?.close(); economy?.close(); vault?.close(); limits?.close(); game = economy = vault = limits = null; };
  function open() {
    economy = createAssetEconomy({ path: join(directory, 'credits.sqlite'), asset: usedAsset, terms: options.terms ?? terms, now: options.now,
      unsignedLifetimeMs: options.unsignedLifetimeMs });
    economy.openRound(roundId, options.models);
    vault = createVaultService({ apiKey: 'fixture-not-real', payment: options.paidInference, logDir: directory, sessionsPath: join(directory, 'sessions.sqlite'),
      fetchImpl: async (url, init = {}) => {
        if (url === 'https://openrouter.ai/api/v1/models') {
          const catalog = [...new Set([...DEFAULT_GUARDIANS, ...(options.models ?? [])])];
          return Response.json({ data: catalog.map(id => ({ id, supported_parameters: ['tools'], pricing: { prompt: '0.00001', completion: '0.00001' } })) });
        }
        if (options.paidInference && url === BLOCKRUN_CHAT) {
          if (!init.headers?.['PAYMENT-SIGNATURE']) {
            return Response.json({ x402Version: 2, accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '2000', asset: BASE_USDC,
              payTo: address('a'), maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' } }], price: { amount: '0.002000', currency: 'USD' } }, { status: 402 });
          }
          const body = JSON.parse(init.body); calls.push({ transport: 'x402', ...body });
          return Response.json(controls.transport ? await controls.transport(body) : completion(body.model));
        }
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
        const body = JSON.parse(init.body); calls.push(body);
        return Response.json(controls.transport ? await controls.transport(body) : completion(body.model));
      } });
    limits = createInferenceLimits({ path: join(directory, 'usage.sqlite'), ...options.limits });
    game = createAuthenticatedCreditGame({ path: jobsPath, economy, authentication, limits,
      vault: { status: vault.status, attempt: async (input, scope) => {
        const value = await vault.attempt(input, options.paidInference ? { ...scope, billing: 'x402' } : scope);
        return controls.mapReply ? controls.mapReply(structuredClone(value)) : value;
      } } });
  }
  function deposit(principal = alice, amount = '1000', transaction = 'a') {
    const owner = principal.wallets[0].address;
    const order = economy.ledger.deposits.create({ key: 'deposit-' + transaction, owner, minimumReceived: amount }, principal, { chainHead: '0x63' });
    const reference = { transactionHash: hash(transaction), logIndex: '0x0' };
    economy.ledger.deposits.attach(order.id, principal, reference);
    const evidence = { chainId: '0x' + BigInt(usedAsset.chainId).toString(16), headBlockNumber: '0x66', canonicalBlock: { number: '0x64', hash: hash('b') },
      receipt: { ...reference, status: '0x1', blockNumber: '0x64', blockHash: hash('b'), logs: [{ ...reference, address: usedAsset.tokenAddress,
        blockNumber: '0x64', blockHash: hash('b'), removed: false,
        topics: [TRANSFER_TOPIC, '0x' + '0'.repeat(24) + owner.slice(2), '0x' + '0'.repeat(24) + usedAsset.destination.slice(2)],
        data: '0x' + BigInt(amount).toString(16).padStart(64, '0') }] } };
    const reconcile = () => economy.ledger.deposits.reconcile(order.id, principal, evidence); reconcile();
    return { order, principal, evidence, reconcile };
  }
  const cleanup = async () => {
    closeServices();
    if (!resolve(directory).startsWith(root + sep) || !directory.includes('vault-account-game-')) throw new Error('Unsafe fixture cleanup path.');
    await rm(directory, { recursive: true, force: true });
  };
  try { open(); }
  catch (error) { await cleanup(); throw error; }
  return { get economy() { return economy; }, get vault() { return vault; }, get game() { return game; }, get limits() { return limits; },
    headers, alice, bob, calls, controls, jobsPath, authentication, deposit, restart: () => { closeServices(); open(); }, close: cleanup };
}
