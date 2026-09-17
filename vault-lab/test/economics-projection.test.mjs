import test from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMIC_DEFAULTS as defaults, projectEconomy } from '../public/economics-model.js';

test('round projection conserves token allocation and counts refunded errors as API cost', () => {
  const r = projectEconomy(defaults);
  assert.equal(r.balanced,true); assert.equal(r.consumed,10000); assert.equal(r.prizeTokens,8000);
  assert.equal(r.operatingTokens,2000); assert.equal(r.nextRoundTokens,1000);
  assert.ok(Math.abs(r.expectedApiCalls-111.111111111) < 1e-8);
  assert.ok(r.apiCostsUsd > defaults.apiUsd*defaults.validAttempts);
  assert.equal(r.netOperationsUsd,14); assert.equal(r.nextRoundSeedCoverage,1);
});
test('zero token realization leaves costs unfunded without spending the prize or player credits', () => {
  for (const change of [{tokenUsd:0},{conversionLossPercent:100},{operationsPercent:0}]) {
    const r = projectEconomy({...defaults,...change});
    assert.equal(r.externalOperatingSupportUsd,r.costsUsd); assert.ok(r.prizeTokens>0);
  }
  assert.equal(projectEconomy({...defaults,operationsPercent:0}).breakEvenTokenUsd,null);
});
test('sponsors and received creator fees increase only the prize; rounding happens per attempt', () => {
  const a = projectEconomy(defaults), b = projectEconomy({...defaults,sponsorTokens:500,creatorTokens:300});
  assert.equal(b.prizeTokens-a.prizeTokens,800); assert.equal(b.operatingResultUsd,a.operatingResultUsd);
  const rounded = projectEconomy({...defaults,attemptTokens:3,prizePercent:33,operationsPercent:33,validAttempts:10});
  assert.deepEqual(rounded.perAttempt,{prize:0,operations:0,next:3}); assert.equal(rounded.nextRoundTokens,30);
});
test('invalid and impossible assumptions fail visibly; zero costs are valid', () => {
  for (const change of [{errorPercent:100},{tokenUsd:NaN},{prizePercent:90,operationsPercent:20},{validAttempts:0},{seedTokens:-1},{attemptTokens:1.5}]) assert.throws(()=>projectEconomy({...defaults,...change}));
  assert.equal(projectEconomy({...defaults,apiUsd:0,fixedUsd:0}).costsUsd,0);
});
