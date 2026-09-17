// Public catalog and unpaid quote research only. No keys, wallets or signed retries.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');
async function request(url, body, headers = {}) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { notJson: true }; }
  return { url, status: response.status, responseHash: sha256(raw), data };
}
const record = { checkedAt: new Date().toISOString(), purpose: 'unpaid quote discovery',
  keysUsed: false, signaturesCreated: 0, paymentsSubmitted: 0, paidCompletionsRequested: 0, observations: [] };
const catalog = await request('https://blockrun.ai/api/v1/models');
record.observations.push({ ...catalog, data: { models: catalog.data.data?.filter(m =>
  ['anthropic/claude-haiku-4.5', 'google/gemini-2.5-flash'].includes(m.id)) } });
const matrix = await request('https://nano-gpt.com/api/v1/x402/endpoints');
record.observations.push({ ...matrix, data: { routes: matrix.data.data?.filter(r => r.endpoint === '/api/v1/chat/completions') } });
const payload = { model: 'anthropic/claude-haiku-4.5', messages: [{ role: 'user', content: 'Say ok.' }], max_tokens: 128, stream: false };
const quotes = [];
if (catalog.data.data?.some(m => m.id === payload.model && m.billing_mode === 'paid')) {
  quotes.push(await request('https://blockrun.ai/api/v1/chat/completions', payload));
}
if (matrix.data.data?.some(r => r.endpoint === '/api/v1/chat/completions' && r.supported)) {
  quotes.push(await request('https://nano-gpt.com/api/v1/chat/completions',
    { ...payload, model: 'gpt-4.1-nano' }, { 'x-x402': 'true' }));
}
for (const result of quotes) {
  // Exclude invoice/token material and ephemeral completion URLs from the report.
  const payment = result.data.payment;
  const options = payment?.accepted ?? result.data.accepts ?? [];
  record.observations.push({ url: result.url, status: result.status, responseHash: result.responseHash,
    quotedModel: result.url.includes('blockrun') ? payload.model : 'gpt-4.1-nano',
    requestType: 'public synthetic prompt, max_tokens=128, stream=false, no auth/payment',
    price: result.data.price ?? payment?.amountUsd ?? null,
    requestHash: payment?.requestHash ?? null, expiresAt: payment?.expiresAt ?? null,
    paymentOptions: options.map(o => ({ scheme: o.scheme, network: o.network, asset: o.asset,
      amount: o.amount ?? o.maxAmountRequired, amountUsd: o.amountUsd,
      maxTimeoutSeconds: o.maxTimeoutSeconds })),
    expectedPaymentRequired: result.status === 402 });
}
await mkdir('output/payment-research', { recursive: true });
await writeFile('output/payment-research/unpaid-quotes-20260915.json', JSON.stringify(record, null, 2));
console.log(JSON.stringify(record, null, 2));
