import { getAddress, hexToNumber } from 'viem';
import { apiError } from './errors.mjs';

export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const X402_NETWORK = 'eip155:8453';
export const BLOCKRUN_CHAT = 'https://blockrun.ai/api/v1/chat/completions';

const TYPES = { TransferWithAuthorization: [
  { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }
] };

export function selectExactBaseUsdc(response) {
  const accepts = Array.isArray(response?.data?.accepts) ? response.data.accepts : [];
  const selected = accepts.find(item => item?.scheme === 'exact' && item.network === X402_NETWORK &&
    typeof item.amount === 'string' && /^[1-9][0-9]{0,18}$/.test(item.amount) &&
    typeof item.asset === 'string' && getAddress(item.asset) === BASE_USDC);
  if (!selected) throw apiError(502, 'X402_QUOTE_UNSUPPORTED', 'The provider did not offer an exact USDC Base quote. No payment was signed.');
  return {
    scheme: 'exact', network: X402_NETWORK, amount: selected.amount, asset: BASE_USDC,
    payTo: getAddress(selected.payTo), maxTimeoutSeconds: Number.isInteger(selected.maxTimeoutSeconds) ? selected.maxTimeoutSeconds : 300,
    extra: { name: selected.extra?.name || 'USD Coin', version: selected.extra?.version || '2' }
  };
}

export async function signExactPayment({ account, requirement, now = () => Math.floor(Date.now() / 1000), nonce }) {
  const issued = now();
  const authorization = {
    from: account.address, to: requirement.payTo, value: BigInt(requirement.amount),
    validAfter: BigInt(issued - 600), validBefore: BigInt(issued + requirement.maxTimeoutSeconds),
    nonce: nonce || `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`
  };
  const signature = await account.signTypedData({
    domain: { name: requirement.extra.name, version: requirement.extra.version, chainId: hexToNumber('0x2105'), verifyingContract: BASE_USDC },
    types: TYPES, primaryType: 'TransferWithAuthorization', message: authorization
  });
  const payload = { x402Version: 2, resource: { url: BLOCKRUN_CHAT, mimeType: 'application/json' },
    accepted: requirement, payload: { signature, authorization: {
      from: authorization.from, to: authorization.to, value: String(authorization.value),
      validAfter: String(authorization.validAfter), validBefore: String(authorization.validBefore), nonce: authorization.nonce
    } } };
  return { header: Buffer.from(JSON.stringify(payload)).toString('base64'), payload };
}

async function readHttp(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { ...init, signal: controller.signal });
        const reader = response.body?.getReader();
        const chunks = [];
        let size = 0;
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 8 * 1024 * 1024) { await reader.cancel(); throw apiError(502, 'UPSTREAM_INVALID', 'The provider response exceeds the allowed size.'); }
            chunks.push(value);
          }
        }
        let data = null;
        if (chunks.length) {
          try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { throw apiError(502, 'UPSTREAM_INVALID', 'The provider response is not valid JSON.'); }
        }
        return { ok: response.ok, status: response.status, headers: response.headers, data };
      })(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => { reject(apiError(504, 'UPSTREAM_TIMEOUT', 'The API did not complete the attempt within the time limit. This does not count as a loss.')); controller.abort(); }, timeoutMs);
      })
    ]);
  } catch (error) {
    if (error.status) throw error;
    throw apiError(502, 'UPSTREAM_UNAVAILABLE', 'Could not get a valid response from the API. This does not count as a loss.');
  } finally { clearTimeout(timer); }
}

function generationBody(generation = {}) {
  const { temperature, max_tokens, tool_choice, stream = false, tools } = generation;
  return { temperature, max_tokens, tool_choice, stream, ...(tools ? { tools } : {}) };
}

export async function requestPaidCompletion({ fetchImpl, payer, modelId, messages, timeoutMs, generation, tools }) {
  if (!payer?.sign || !payer.assertCoverage) throw apiError(503, 'X402_NOT_CONFIGURED', 'Funded inference has no operating-box payer. No credits were reserved.');
  const body = JSON.stringify({ model: modelId, messages, ...generationBody({ ...generation, tools }), stream: false });
  const unpaid = await readHttp(fetchImpl, BLOCKRUN_CHAT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, timeoutMs);
  if (unpaid.status !== 402) throw apiError(502, 'UPSTREAM_HTTP_ERROR', 'The provider did not return a payable quote. No payment was signed.', { upstreamStatus: unpaid.status });
  const selected = selectExactBaseUsdc(unpaid);
  const hold = await payer.assertCoverage(selected.amount);
  let signed;
  try { signed = await payer.sign(selected); }
  catch (error) { hold?.release?.(); throw error; }
  try {
    const paid = await readHttp(fetchImpl, BLOCKRUN_CHAT, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': signed.header }, body }, timeoutMs);
    if (!paid.ok) {
      hold?.release?.();
      throw apiError(502, paid.data?.code === 'PAYMENT_UNFUNDED' ? 'X402_PAYMENT_REJECTED' : 'UPSTREAM_HTTP_ERROR',
        'The paid inference request was rejected. Credits are returned when no model result was produced.', { upstreamStatus: paid.status });
    }
    return { data: paid.data, quote: selected, payment: { settled: paid.headers?.get?.('x-payment-settled') !== 'false',
      receipt: paid.headers?.get?.('payment-response') || paid.headers?.get?.('x-payment-receipt') || null } };
  } catch (error) {
    if (error.code === 'X402_PAYMENT_REJECTED' || error.code === 'UPSTREAM_HTTP_ERROR') throw error;
    throw apiError(503, 'PAYMENT_UNCERTAIN', 'A payment authorization was sent and the result is unknown. Do not retry this attempt. Credits stay reserved until reconciliation.', { quote: selected });
  }
}
