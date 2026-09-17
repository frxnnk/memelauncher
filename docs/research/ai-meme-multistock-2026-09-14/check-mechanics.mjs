// Mathematical checks, not Solidity tests, a backtest, or a return forecast.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const ceilDiv = (a, b) => (a + b - 1n) / b;
let checkedStates = 0;
for (let supply = 1n; supply <= 50n; supply++) {
  for (let requested = 1n; requested <= 15n; requested++) {
    const balances = [supply * 71n + 3n, supply * 103n + 1n, supply * 29n + 5n];
    const incoming = balances.map(b => ceilDiv(requested * b, supply));
    const nextSupply = supply + requested;
    const nextBalances = balances.map((b, i) => b + incoming[i]);
    for (let i = 0; i < balances.length; i++) {
      // Per-share reserve of every component cannot decrease on a proportional mint.
      assert(nextBalances[i] * supply >= balances[i] * nextSupply);
      const out = requested * nextBalances[i] / nextSupply;
      // Immediate round trip cannot extract more of a component than deposited.
      assert(out <= incoming[i]);
      assert(nextBalances[i] - out >= balances[i]);
    }
    checkedStates++;
  }
}

// Three identical full-range constant-product markets. No fees, fixed external
// stock prices, unlimited stock/USD arbitrage, no net MEME flow from outsiders.
// The total MEME held by pools stays constant; arbitrage equalizes MEME USD price.
const stockFactors = [2, 1, 1];
const memeFactor = (stockFactors.reduce((sum, p) => sum + Math.sqrt(p), 0) / 3) ** 2;
const equalWeightBuyHoldFactor = stockFactors.reduce((a, b) => a + b) / 3;
assert(Math.abs(memeFactor - equalWeightBuyHoldFactor) > 0.01);

// An oracle already adjusted for corporate actions must not be scaled twice.
const rawBalance = 2;
const underlyingPrice = 100;
const multiplier = 1.05;
const tokenOraclePrice = underlyingPrice * multiplier;
assert.equal(rawBalance * tokenOraclePrice, 210);
assert.equal(rawBalance * multiplier * tokenOraclePrice, 220.5);

const result = {
  status: 'MATHEMATICAL_CHECKS_PASSED',
  proportionalMintRedeemStates: checkedStates,
  assumptions: ['Positive seeded supply', 'Integer raw token balances', 'No fees or balance-changing transfers', 'All component transfers succeed'],
  marketExample: { stockFactors, threePoolMemeReturnPercent: 100 * (memeFactor - 1), equalWeightBuyHoldReturnPercent: 100 * (equalWeightBuyHoldFactor - 1), scope: 'Simplified full-range zero-fee model; not the live Long v4 hook' },
  oracleExample: { rawBalance, underlyingPrice, multiplier, tokenOraclePrice, correctValue: 210, incorrectDoubleScaledValue: 220.5 },
  notValidated: ['EVM behavior', 'Token pause/freeze behavior', 'Live swap depth', 'Gas', 'First-depositor/donation attack defenses', 'Fees', 'Rebalance execution', 'Profitability'],
};
await writeFile(new URL('./mechanics-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
