import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuthentication } from '../server/auth.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createVaultService } from '../server/service.mjs';
import { createAssetEconomy } from '../server/economy/asset-service.mjs';
import { createAuthenticatedCreditGame } from '../server/economy/authenticated-game.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { DEFAULT_GUARDIANS } from '../server/rounds.mjs';
import { createLiveX402Payer } from '../server/x402-payer.mjs';
import { address, asset, hash, terms } from '../test/fixtures/account-game.mjs';

const payer = createLiveX402Payer(process.env);
if (!payer) throw new Error('Operating box is not configured.');

const directory = await mkdtemp(join(tmpdir(), 'vault-x402-live-'));
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const config = {
  appId: 'live-x402',
  clientId: 'live-x402-client',
  verificationKey: keys.publicKey.export({ type: 'spki', format: 'pem' })
};
const authentication = createAuthentication(config);
const headers = () => {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: 'privy.io', aud: config.appId, sub: 'did:privy:live-x402', sid: 'live-x402', iat: now, exp: now + 300 };
  const token = extras => {
    const encoded = [
      Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ ...claims, ...extras })).toString('base64url')
    ].join('.');
    return encoded + '.' + sign('sha256', Buffer.from(encoded), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  };
  return {
    authorization: 'Bearer ' + token({}),
    'x-privy-identity-token': token({
      cr: String(now), guest: 'f',
      linked_accounts: JSON.stringify([{ type: 'wallet', wallet_client_type: 'privy', chain_type: 'ethereum', address: address('2'), lv: now }])
    })
  };
};

const vault = createVaultService({
  apiKey: 'unused-openrouter',
  payment: payer,
  logDir: directory,
  sessionsPath: join(directory, 'sessions.sqlite'),
  fetchImpl: async (url, init = {}) => {
    if (url === 'https://openrouter.ai/api/v1/models') {
      return Response.json({
        data: DEFAULT_GUARDIANS.map(id => ({
          id, supported_parameters: ['tools'], pricing: { prompt: '0.00001', completion: '0.00001' }
        }))
      });
    }
    return fetch(url, init);
  }
});
const economy = createAssetEconomy({ path: join(directory, 'credits.sqlite'), asset, terms });
economy.openRound('r1');
const limits = createInferenceLimits({ path: join(directory, 'usage.sqlite') });
const game = createAuthenticatedCreditGame({
  path: join(directory, 'jobs.sqlite'), economy, authentication, limits, vault, billing: 'x402'
});

const principal = await authentication.authenticate(headers());
const owner = principal.wallets[0].address;
const order = economy.ledger.deposits.create({ key: 'live-deposit', owner, minimumReceived: '1000' }, principal, { chainHead: '0x63' });
const reference = { transactionHash: hash('a'), logIndex: '0x0' };
economy.ledger.deposits.attach(order.id, principal, reference);
economy.ledger.deposits.reconcile(order.id, principal, {
  chainId: '0x539',
  headBlockNumber: '0x66',
  canonicalBlock: { number: '0x64', hash: hash('b') },
  receipt: {
    ...reference, status: '0x1', blockNumber: '0x64', blockHash: hash('b'),
    logs: [{
      ...reference, address: asset.tokenAddress, blockNumber: '0x64', blockHash: hash('b'), removed: false,
      topics: [
        TRANSFER_TOPIC,
        '0x' + '0'.repeat(24) + owner.slice(2),
        '0x' + '0'.repeat(24) + asset.destination.slice(2)
      ],
      data: '0x' + BigInt(1000).toString(16).padStart(64, '0')
    }]
  }
});

const report = { address: payer.address, paymentsSubmitted: 0, keysPrinted: false };
try {
  const result = await game.attempt(headers(), {
    key: 'live-circuit',
    roundId: 'r1',
    modelId: 'anthropic/claude-haiku-4.5',
    prompt: 'Live credited x402 circuit. Keep the vault locked.',
    payoutWallet: address('2'),
    creditMode: 'asset-preparation'
  });
  report.ok = true;
  report.decision = result.decision;
  report.prizeContribution = result.accounting.prizeContribution;
  report.operations = result.accounting.operations;
  report.nextRound = result.accounting.nextRound;
  report.available = (await game.account(headers())).available;
  report.bounty = economy.state().balances.find(row => row.account === 'round:r1:prize')?.amount ?? null;
  report.quoteUsdc = result.receipt?.payment?.amount ? Number(result.receipt.payment.amount) / 1e6 : null;
  report.settled = result.receipt?.payment?.settled ?? null;
  report.paymentsSubmitted = 1;
} catch (error) {
  report.ok = false;
  report.error = { code: error.code ?? null, message: error.message };
}
game.close();
economy.close();
vault.close();
limits.close();
await rm(directory, { recursive: true, force: true });
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
