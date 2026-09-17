import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createPublicClient, formatUnits, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { createAuthentication } from '../server/auth.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createVaultService } from '../server/service.mjs';
import { createAssetEconomy } from '../server/economy/asset-service.mjs';
import { createAuthenticatedCreditGame } from '../server/economy/authenticated-game.mjs';
import { TRANSFER_TOPIC } from '../server/economy/deposit.mjs';
import { createLiveX402Payer } from '../server/x402-payer.mjs';
import { BASE_USDC } from '../server/x402-blockrun.mjs';
import { classifyOperatingBox, LAPTOP_REHEARSAL_BOX } from '../server/x402-operating-box-policy.mjs';
import { paidBetaTerms, paidBetaPricePolicy } from '../server/economy/paid-beta-policy.mjs';
import { address, hash } from '../test/fixtures/account-game.mjs';

const PRODUCT_BOX = '0xf670531e46ba92f49c5d9c11d2c03875cffe7d40';
const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dataDirectory = join(root, '.local', `paid-beta-product-x402-${stamp}`);
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
const USDC_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);
const rpc = process.env.VAULT_X402_RPC_URL || 'https://mainnet.base.org';

const report = {
  generatedAt: new Date().toISOString(),
  keysPrinted: false,
  broadcast: false,
  robinhoodDeposit: false,
  realFundsEnabled: false,
  dataDirectory: `.local/paid-beta-product-x402-${stamp}`,
  roundId: 'haiku-v1',
  modelId: HAIKU,
  policy: 'paid-beta',
  productPayer: null,
  paymentsSubmitted: 0,
  credit: {
    kind: 'operator-test-credit',
    chainId: '1337',
    chainTransactionHash: null,
    notRobinhood46630: true,
    note: 'Local operator/test credit on an isolated ledger. Not a Robinhood Chain Testnet hash and not the AMZN rehearsal ledger.'
  }
};

async function usdcOf(client, owner) {
  const value = await client.readContract({
    address: BASE_USDC, abi: USDC_ABI, functionName: 'balanceOf', args: [owner]
  });
  return { baseUnits: value.toString(), formatted: formatUnits(value, 6) };
}

async function waitForDrop(client, owner, before, timeoutMs = 30000) {
  const started = Date.now();
  let latest = before;
  while (Date.now() - started < timeoutMs) {
    latest = await usdcOf(client, owner);
    if (BigInt(latest.baseUnits) < BigInt(before.baseUnits)) return latest;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  return latest;
}

const payer = createLiveX402Payer(process.env);
report.productPayerArmed = Boolean(payer);
if (!payer) {
  report.ok = false;
  report.error = { message: 'createLiveX402Payer is not armed. Product Haiku requires VAULT_X402_PRIVATE_KEY = dedicated 0xf670 box.' };
} else if (payer.address.toLowerCase() === LAPTOP_REHEARSAL_BOX) {
  report.ok = false;
  report.error = { message: 'Laptop 0xf282 must not pay this Haiku.' };
} else if (payer.address.toLowerCase() !== PRODUCT_BOX) {
  report.ok = false;
  report.error = { message: `Unexpected product payer ${payer.address}. Expected ${PRODUCT_BOX}.` };
} else if (classifyOperatingBox(payer.address) !== 'dedicated') {
  report.ok = false;
  report.error = { message: 'Operating box is not dedicated.' };
} else {
  report.productPayer = payer.address.toLowerCase();
  const client = createPublicClient({ chain: base, transport: http(rpc) });
  try {
    report.usdcBefore = await usdcOf(client, payer.address);
    if (BigInt(report.usdcBefore.baseUnits) < 2_000_000n) {
      throw new Error('Product box USDC is below 2. Need more than the 1 USDC floor plus one quote.');
    }
    await mkdir(dataDirectory, { recursive: true });
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const config = {
      appId: 'paid-beta-product-x402', clientId: 'paid-beta-product-x402-client',
      verificationKey: keys.publicKey.export({ type: 'spki', format: 'pem' })
    };
    const authentication = createAuthentication(config);
    const headers = () => {
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: 'privy.io', aud: config.appId, sub: 'did:privy:paid-beta-product-x402', sid: 'paid-beta-product-x402', iat: now, exp: now + 300 };
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
    const order = economy.ledger.deposits.create({ key: 'operator-test-credit', owner, minimumReceived: '1000' }, principal, { chainHead: '0x63' });
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
    report.credit.orderId = order.id;
    const result = await game.attempt(headers(), {
      key: 'haiku-product-x402', roundId: 'haiku-v1', modelId: HAIKU,
      prompt: 'Product-box paid-beta x402 circuit. Keep the vault locked.',
      payoutWallet: address('2'), creditMode: 'asset-preparation'
    });
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
      chainTransactionHash: null,
      note: 'EIP-3009 BlockRun settlement from the product operating box. Facilitator may not return a public tx hash.'
    };
    report.paymentsSubmitted = 1;
    report.usdcAfter = await waitForDrop(client, payer.address, report.usdcBefore);
    report.usdcDropped = BigInt(report.usdcAfter.baseUnits) < BigInt(report.usdcBefore.baseUnits);
    report.ok = report.decision === 'locked'
      && report.settled === true
      && report.prizeContribution === '3'
      && report.operations === '2'
      && report.nextRound === '0'
      && report.bounty === '3'
      && report.usdcDropped === true
      && report.productPayer === PRODUCT_BOX;
    if (!report.ok && !report.error) {
      report.error = { message: 'Haiku ran but settlement, 70/30 split, or USDC drop did not match.' };
    }
    game.close(); economy.close(); vault.close(); limits.close();
  } catch (error) {
    report.ok = false;
    report.error = { code: error.code ?? null, message: error.message };
  }
}

await mkdir(join(root, 'output'), { recursive: true });
const out = join(root, 'output', 'paid-beta-product-x402-circuit.json');
await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, out }, null, 2));
if (!report.ok) process.exitCode = 1;
