import test from 'node:test';
import assert from 'node:assert/strict';
import {createEconomyService} from '../server/economy/service.mjs';
import {verifyLedgerExport} from '../audit/verify-ledger.mjs';

function fixture() {
  const economy=createEconomyService();
  try {
    economy.action({action:'topup',key:'topup',amount:'1000'});
    economy.action({action:'seed',key:'seed',roundId:'round-1',amount:'1000'});
    const reserved=economy.action({action:'reserve',key:'attempt',roundId:'round-1'});
    economy.action({action:'released',key:'settle',attemptId:reserved.result.attemptId});
    economy.action({action:'payout',key:'payout',roundId:'round-1'});
    return economy.export();
  } finally {economy.close();}
}
test('a full export reproduces the winner, payout and balances offline without claiming execution proof',()=>{
  const snapshot=fixture(),before=JSON.stringify(snapshot),report=verifyLedgerExport(snapshot);
  assert.equal(report.status,'internally-consistent');assert.equal(report.eventsChecked,7);
  assert.equal(report.custody,'930');assert.equal(report.independentExecutionProof,false);
  assert.equal(JSON.stringify(snapshot),before);
});
test('changing a balance, event result, request hash, sequence or winner fails replay',()=>{
  for(const change of [
    s=>{s.balances[0].amount='99999';},s=>{s.events[1].result.received='5';},
    s=>{s.events[1].requestHash='0'.repeat(64);},s=>{s.events[2].sequence=90;},
    s=>{s.rounds[0].winner='somebody';}
  ]) {const s=fixture();change(s);assert.throws(()=>verifyLedgerExport(s));}
});
test('truncated or foreign-unit exports cannot be presented as a verified TEST ledger',()=>{
  const truncated=fixture();truncated.events.pop();assert.throws(()=>verifyLedgerExport(truncated));
  const wrongUnit=fixture();wrongUnit.unit={...wrongUnit.unit,symbol:'ETH'};assert.throws(()=>verifyLedgerExport(wrongUnit));
  const duplicate=fixture();duplicate.events[1].key=duplicate.events[0].key;assert.throws(()=>verifyLedgerExport(duplicate));
});

test('round configuration substitutions and omitted manifests fail offline verification', () => {
  assert.equal(verifyLedgerExport(fixture()).roundManifestsChecked, 1);
  const changed = fixture(); changed.roundManifests[0].manifest.configuration.price = '1';
  assert.throws(() => verifyLedgerExport(changed), /manifest/);
  const missing = fixture(); delete missing.roundManifests;
  assert.throws(() => verifyLedgerExport(missing), /missing its manifest/);
});
