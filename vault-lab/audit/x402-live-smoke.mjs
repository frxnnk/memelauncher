import { createPublicClient, formatEther, formatUnits, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { createLiveX402Payer, createX402Payer } from '../server/x402-payer.mjs';
import { BASE_USDC, requestPaidCompletion } from '../server/x402-blockrun.mjs';
import { RULES } from '../server/rules.mjs';
import { LAPTOP_REHEARSAL_BOX } from '../server/x402-operating-box-policy.mjs';
import { privateKeyToAccount } from 'viem/accounts';

const report = { checkedAt: new Date().toISOString(), keysPrinted: false, paymentsSubmitted: 0 };
try {
  const key = process.env.VAULT_X402_PRIVATE_KEY?.trim() || '';
  report.keyPresent = Boolean(key);
  report.keyFormat = /^0x[0-9a-fA-F]{64}$/.test(key) ? '0x-hex-64' : key && /^[0-9a-fA-F]{64}$/.test(key) ? 'hex-64-missing-0x' : 'invalid-or-empty';
  if (report.keyFormat === 'hex-64-missing-0x') {
    process.env.VAULT_X402_PRIVATE_KEY = '0x' + key;
    report.keyFormat = '0x-hex-64-normalized';
  }
  let payer = createLiveX402Payer(process.env);
  if (!payer) {
    const raw = process.env.VAULT_X402_PRIVATE_KEY?.trim() || '';
    const key = raw.startsWith('0x') ? raw : raw ? `0x${raw}` : '';
    if (/^0x[0-9a-fA-F]{64}$/.test(key) && privateKeyToAccount(key).address.toLowerCase() === LAPTOP_REHEARSAL_BOX) {
      const rpc = process.env.VAULT_X402_RPC_URL || 'https://mainnet.base.org';
      const client = createPublicClient({ chain: base, transport: http(rpc) });
      payer = createX402Payer({
        privateKey: key,
        floor: BigInt(Math.round(Number(process.env.VAULT_X402_FLOOR_USDC ?? '1') * 1e6)),
        readBalance: () => client.readContract({ address: BASE_USDC, abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']), functionName: 'balanceOf', args: [privateKeyToAccount(key).address] })
      });
      report.localLaptopRehearsal = true;
    }
  }
  if (!payer) throw new Error('Operating box is not configured.');
  report.address = payer.address;
  const client = createPublicClient({ chain: base, transport: http(process.env.VAULT_X402_RPC_URL || 'https://mainnet.base.org') });
  const [eth, usdc] = await Promise.all([
    client.getBalance({ address: payer.address }),
    client.readContract({ address: BASE_USDC, abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']), functionName: 'balanceOf', args: [payer.address] })
  ]);
  report.eth = formatEther(eth);
  report.usdc = formatUnits(usdc, 6);
  report.floorUsdc = process.env.VAULT_X402_FLOOR_USDC || '1';
  if (usdc < 2_000_000n) throw new Error('USDC balance is below 2. Need more than the 1 USDC floor plus one quote.');
  const paid = await requestPaidCompletion({
    fetchImpl: fetch, payer, timeoutMs: 45000,
    modelId: 'anthropic/claude-haiku-4.5',
    tools: RULES.tools,
    generation: { temperature: 0.7, max_tokens: 128, tool_choice: 'auto', stream: false },
    messages: [
      { role: 'system', content: 'You are a vault guardian in a test. Call keep_locked. Do not call release_prize.' },
      { role: 'user', content: 'This is a live x402 circuit check. Keep the vault locked.' }
    ]
  });
  report.paymentsSubmitted = 1;
  report.quoteUsdc = Number(paid.quote.amount) / 1e6;
  report.settled = paid.payment.settled;
  report.model = paid.data?.model ?? null;
  report.finishReason = paid.data?.choices?.[0]?.finish_reason ?? null;
  report.hasToolCall = Boolean(paid.data?.choices?.[0]?.message?.tool_calls?.length);
  report.ok = Boolean(paid.data?.choices?.[0]);
} catch (error) {
  report.ok = false;
  report.error = { code: error.code ?? null, message: error.message };
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
