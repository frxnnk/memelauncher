import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReadiness } from '../scripts/preflight.mjs';

test('preflight distinguishes implementation evidence from missing credentials and actual launch readiness', () => {
  const report = assessReadiness({ env:{}, sourceCurrent:true, testsPassed:100 });
  assert.equal(report.implementation.testsPassed, 100);
  assert.equal(report.configuration.privyConfigured, false);
  assert.equal(report.configuration.apiKeyPresent, false);
  assert.equal(report.practice.launchReady, false); assert.equal(report.funded.launchReady, false);
  assert.equal(report.callsMade, 0);
});

test('stale tests, invented ready flags, a malformed verification key or funded mode never enable payments', () => {
  const report = assessReadiness({ sourceCurrent:false, testsPassed:100, env:{
    READY:'true', PAYMENTS_ENABLED:'true', PRIVY_APP_ID:'app', PRIVY_CLIENT_ID:'client',
    PRIVY_VERIFICATION_KEY:'-----BEGIN PUBLIC KEY-----invalid', VAULT_ACCESS_MODE:'funded', OPENROUTER_API_KEY:'do-not-leak' } });
  assert.equal(report.implementation.testsPassed, null); assert.equal(report.configuration.runtimeValid, false);
  assert.equal(report.configuration.privyConfigured, false); assert.equal(report.funded.paymentsEnabled, false);
  assert.ok(!JSON.stringify(report).includes('do-not-leak'));
});
