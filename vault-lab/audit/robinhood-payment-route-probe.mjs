// Research only: unsigned quotes, synthetic address, no wallet or transaction submission.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const report = { checkedAt: new Date().toISOString(), signatures: 0, transactions: 0,
  addressPurpose: 'Synthetic address 0x1, not a user wallet; execution is NOT tested', quotes: [] };
const token = item => item && ({ chainId: item.currency?.chainId,
  address: item.currency?.address, symbol: item.currency?.symbol,
  decimals: item.currency?.decimals, amount: item.amount,
  amountFormatted: item.amountFormatted, amountUsd: item.amountUsd,
  minimumAmount: item.minimumAmount });

for (const amount of ['1000000', '10000000']) {
  const request = { user: '0x0000000000000000000000000000000000000001',
    originChainId: 4663, destinationChainId: 8453,
    originCurrency: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    destinationCurrency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    amount, tradeType: 'EXACT_INPUT' };
  const endpoint = 'https://api.relay.link/quote/v2';
  try {
    const response = await fetch(endpoint, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(request),
      signal: AbortSignal.timeout(20000) });
    const raw = await response.text();
    const data = JSON.parse(raw);
    report.quotes.push({ endpoint, request, checkedAt: new Date().toISOString(),
      status: response.status, responseHash: createHash('sha256').update(raw).digest('hex'),
      input: token(data.details?.currencyIn), output: token(data.details?.currencyOut),
      totalImpact: data.details?.totalImpact, slippageTolerance: data.details?.slippageTolerance,
      timeEstimate: data.details?.timeEstimate, isFixedRate: data.details?.isFixedRate,
      fees: Object.fromEntries(Object.entries(data.fees ?? {}).map(([key, value]) => [key, token(value)])),
      steps: data.steps?.map(step => ({ id: step.id, kind: step.kind, action: step.action })),
      error: data.error ?? data.message, errorCode: data.errorCode });
  } catch (error) {
    report.quotes.push({ endpoint, request, error: error.message });
  }
}
// Persist summaries only; discard executable calldata and ephemeral request identifiers.
await mkdir('output/payment-research', { recursive: true });
const path = 'output/payment-research/robinhood-relay-quotes-20260915.json';
await writeFile(path, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ path, checkedAt: report.checkedAt, quotes: report.quotes.map(q => ({
  status: q.status, input: q.input?.amountFormatted, output: q.output?.amountFormatted,
  minimumOutput: q.output?.minimumAmount, impact: q.totalImpact, gas: q.fees?.gas?.amountUsd,
  error: q.error })) }, null, 2));
