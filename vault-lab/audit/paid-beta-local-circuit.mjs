import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createPublicClient, formatUnits, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createAuthentication } from '../server/auth.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createVaultService } from '../server/service.mjs';
import { createAssetEconomy } from '../server/economy/asset-service.mjs';
import { createAuthenticatedCreditGame } from '../server/economy/authenticated-game.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { createLiveX402Payer, createX402Payer } from '../server/x402-payer.mjs';
import { BASE_USDC } from '../server/x402-blockrun.mjs';
import { classifyOperatingBox, LAPTOP_REHEARSAL_BOX } from '../server/x402-operating-box-policy.mjs';
import { paidBetaTerms, paidBetaPricePolicy } from '../server/economy/paid-beta-policy.mjs';
import { address, hash } from '../test/fixtures/account-game.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dataDirectory = join(root, '.local', `paid-beta-circuit-${stamp}`);
const HAIKU = 'anthropic/claude-haiku-4.5';
const prices = paidBetaPricePolicy(0);
const terms = {
  ...paidBetaTerms(),
  price: prices.basePrice,
  priceStep: prices.stepPrice,
  maximumPrice: prices.maximumPrice,
  durationMonths: 5
};
const asset = {
  chainId: '1337', tokenAddress: address('1'), destination: address('3'), decimals: 18,
  minimumConfirmations: 3, standardTransferVerified: true
};

const report = {
  generatedAt: new Date().toISOString(),
  keysPrinted: false,
  broadcast: false,
  realFundsEnabled: false,
  dataDirectory: `.local/paid-beta-circuit-${stamp}`,
  roundId: 'haiku-v1',
  modelId: HAIKU,
  policy: 'paid-beta',
  productPayerArmed: false,
  localSmokePayerKind: null,
  paymentsSubmitted: 0,
  missingForLiveClaim: [
    'VAULT_TESTNET_CLAIM_PRIVATE_KEY (dedicated Robinhood testnet signer; never the product treasury or deposit payer)',
    'VAULT_FUNDING_RPC_URL',
    'VAULT_WEB_FUNDING_CONFIG on a NEW directory (not web-funding-testnet)'
  ]
};

function laptopPayer(env) {
  const raw = env.VAULT_X402_PRIVATE_KEY?.trim() || '';
  const key = raw.startsWith('0x') ? raw : raw ? `0x${raw}` : '';
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const account = privateKeyToAccount(key);
  if (classifyOperatingBox(account.address) !== 'laptop-rehearsal') return null;
  const rpc = env.VAULT_X402_RPC_URL || 'https://mainnet.base.org';
  const client = createPublicClient({ chain: base, transport: http(rpc) });
  return createX402Payer({
    privateKey: key,
    floor: BigInt(Math.round(Number(env.VAULT_X402_FLOOR_USDC ?? '1') * 1e6)),
    readBalance: () => client.readContract({
      address: BASE_USDC, abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
      functionName: 'balanceOf', args: [account.address]
    })
  });
}

const product = createLiveX402Payer(process.env);
report.productPayerArmed = Boolean(product);
if (product) {
  report.ok = false;
  report.error = { message: 'Refusing to run: product createLiveX402Payer armed. Laptop smoke must leave paidConfigured false.' };
} else {
  const payer = laptopPayer(process.env);
  if (!payer) {
    report.ok = false;
    report.error = { message: 'No laptop rehearsal x402 key in gitignored env. Deterministic tests cover the circuit without chain.' };
  } else {
    report.localSmokePayerKind = 'laptop-rehearsal';
    report.localSmokePayerAddress = payer.address.toLowerCase() === LAPTOP_REHEARSAL_BOX ? 'laptop-rehearsal' : 'unexpected';
    const client = createPublicClient({ chain: base, transport: http(process.env.VAULT_X402_RPC_URL || 'https://mainnet.base.org') });
    try {
      const usdc = await client.readContract({
        address: BASE_USDC, abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
        functionName: 'balanceOf', args: [payer.address]
      });
      report.usdc = formatUnits(usdc, 6);
      if (usdc < 2_000_000n) throw new Error('USDC balance is below 2. Need more than the 1 USDC floor plus one quote.');
      await mkdir(dataDirectory, { recursive: true });
      const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const config = {
        appId: 'paid-beta-circuit', clientId: 'paid-beta-circuit-client',
        verificationKey: keys.publicKey.export({ type: 'spki', format: 'pem' })
      };
      const authentication = createAuthentication(config);
      const headers = () => {
        const now = Math.floor(Date.now() / 1000);
        const claims = { iss: 'privy.io', aud: config.appId, sub: 'did:privy:paid-beta-circuit', sid: 'paid-beta-circuit', iat: now, exp: now + 300 };
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
        apiKey: 'unused-openrouter', payment: payer, logDir: dataDirectory,
        sessionsPath: join(dataDirectory, 'sessions.sqlite'),
        fetchImpl: async (url, init = {}) => {
          if (url === 'https://openrouter.ai/api/v1/models') {
            return Response.json({ data: [{ id: HAIKU, supported_parameters: ['tools'], pricing: { prompt: '0.00001', completion: '0.00001' } }] });
          }
          return fetch(url, init);
        }
      });
      const economy = createAssetEconomy({ path: join(dataDirectory, 'credits.sqlite'), asset, terms });
      economy.openRound('haiku-v1', [HAIKU]);
      const limits = createInferenceLimits({ path: join(dataDirectory, 'usage.sqlite') });
      const game = createAuthenticatedCreditGame({
        path: join(dataDirectory, 'jobs.sqlite'), economy, authentication, limits, vault, billing: 'x402'
      });
      const principal = await authentication.authenticate(headers());
      const owner = principal.wallets[0].address;
      const order = economy.ledger.deposits.create({ key: 'circuit-deposit', owner, minimumReceived: '1000' }, principal, { chainHead: '0x63' });
      const reference = { transactionHash: hash('a'), logIndex: '0x0' };
      economy.ledger.deposits.attach(order.id, principal, reference);
      economy.ledger.deposits.reconcile(order.id, principal, {
        chainId: '0x539', headBlockNumber: '0x66',
        canonicalBlock: { number: '0x64', hash: hash('b') },
        receipt: {
          ...reference, status: '0x1', blockNumber: '0x64', blockHash: hash('b'),
          logs: [{
            ...reference, address: asset.tokenAddress, blockNumber: '0x64', blockHash: hash('b'), removed: false,
            topics: [TRANSFER_TOPIC, '0x' + '0'.repeat(24) + owner.slice(2), '0x' + '0'.repeat(24) + asset.destination.slice(2)],
            data: '0x' + BigInt(1000).toString(16).padStart(64, '0')
          }]
        }
      });
      const result = await game.attempt(headers(), {
        key: 'haiku-circuit', roundId: 'haiku-v1', modelId: HAIKU,
        prompt: 'Local paid-beta x402 circuit. Keep the vault locked.',
        payoutWallet: address('2'), creditMode: 'asset-preparation'
      });
      report.ok = true;
      report.decision = result.decision;
      report.receiptId = result.receipt?.id ?? result.attemptId;
      report.manifestHash = result.receipt?.round?.manifestHash ?? null;
      report.prizeContribution = result.accounting.prizeContribution;
      report.operations = result.accounting.operations;
      report.nextRound = result.accounting.nextRound;
      report.available = (await game.account(headers())).available;
      report.bounty = economy.state().balances.find(row => row.account === 'round:haiku-v1:prize')?.amount ?? null;
      report.quoteUsdc = result.receipt?.payment?.amount ? Number(result.receipt.payment.amount) / 1e6 : null;
      report.settled = result.receipt?.payment?.settled ?? null;
      report.x402 = {
        network: result.receipt?.payment?.network ?? null,
        asset: result.receipt?.payment?.asset ?? null,
        amount: result.receipt?.payment?.amount ?? null,
        chainTransactionHash: null
      };
      report.deposit = { synthetic: true, chainTransactionHash: null };
      report.paymentsSubmitted = 1;
      game.close(); economy.close(); vault.close(); limits.close();
    } catch (error) {
      report.ok = false;
      report.error = { code: error.code ?? null, message: error.message };
    }
  }
}

await mkdir(join(root, 'output'), { recursive: true });
const out = join(root, 'output', 'paid-beta-local-circuit.json');
await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, out }, null, 2));
if (!report.ok) process.exitCode = 1;
