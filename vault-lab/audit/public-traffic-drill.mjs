import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { walletAttemptPrice } from '../server/economy/public-pricing.mjs';

const policy = { basePrice:'5000000', stepPrice:'1000000', maximumPrice:'20000000' };
const globalCap = 5000000000n; // 500 stablecoin units in base units for the scenario.
const wallets = Number(process.env.VAULT_DRILL_WALLETS || 1000);
const attemptsPerWallet = Number(process.env.VAULT_DRILL_ATTEMPTS || 10);
if (![wallets, attemptsPerWallet].every(n => Number.isSafeInteger(n) && n > 0 && n <= 100000)) throw new Error('Use positive safe integer drill dimensions.');
let accepted = 0, rejected = 0, total = 0n, perWallet = [];
for (let wallet = 0; wallet < wallets; wallet++) {
  let walletTotal = 0n, walletAccepted = 0;
  for (let count = 0; count < attemptsPerWallet; count++) {
    const amount = BigInt(walletAttemptPrice(policy, count));
    if (total + amount > globalCap) { rejected += attemptsPerWallet - count; break; }
    accepted++; total += amount; walletTotal += amount; walletAccepted++;
  }
  if (wallet < 10) perWallet.push({ wallet:wallet + 1, attempts:walletAccepted, committedBaseUnits:String(walletTotal) });
  if (total >= globalCap) { rejected += (wallets - wallet - 1) * attemptsPerWallet; break; }
}
assert.ok(total <= globalCap);
const report = { checkedAt:new Date().toISOString(), mode:'deterministic-public-traffic-simulation', realFundsEnabled:false,
  policy, globalCap:String(globalCap), wallets, attemptsPerWallet, accepted, rejected, committedBaseUnits:String(total),
  remainingCap:String(globalCap - total), sampleWallets:perWallet,
  limitations:['No network requests or wallet signatures','Does not model sybil resistance','Does not prove provider capacity or costs','Pricing is not wired into live reservations'] };
await mkdir('output/payment-research',{recursive:true});
await writeFile('output/payment-research/public-traffic-drill-20260916.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
