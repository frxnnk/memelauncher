import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createEconomyService } from '../server/economy/service.mjs';
import { createCreditGame } from '../server/economy/model-game.mjs';
import { createVaultService } from '../server/service.mjs';
import { createInferenceLimits } from '../server/limits.mjs';
import { createPublicPractice } from '../server/public-practice.mjs';
import { verifyLedgerExport } from './verify-ledger.mjs';
import { createBetaAccess } from '../server/beta-access.mjs';

const MODEL = 'google/gemini-2.5-flash', OWNER = 'player_restore_fixture';
const authentication = { authenticate:async () => ({ accountId:OWNER }) };

export async function restoreDrill() {
  const tempRoot = resolve(tmpdir()), directory = await mkdtemp(join(tempRoot, 'vault-restore-'));
  assert.ok(resolve(directory).startsWith(tempRoot + sep));
  const source = join(directory, 'source'), backup = join(directory, 'backup'), restored = join(directory, 'restored');
  const bundles = [], inputs = [];
  async function bundle(path) {
    await mkdir(path, { recursive:true });
    const vault = createVaultService({ apiKey:'fixture-not-real', sessionsPath:join(path, 'sessions.sqlite'), logDir:path,
      fetchImpl:async (url, init = {}) => {
        if (url.endsWith('/models')) return Response.json({ data:[{ id:MODEL, supported_parameters:['tools'], pricing:{ prompt:'0.00001', completion:'0.00001' } }] });
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
        inputs.push(JSON.parse(init.body));
        return Response.json({ model:MODEL, provider:'Restore drill fixture', usage:{ cost:0.002 },
          choices:[{ finish_reason:'stop', message:{ role:'assistant', content:'Restore drill fixture. The vault stays locked.' } }] });
      } });
    const economy = createEconomyService({ path:join(path, 'economy.sqlite') });
    const game = createCreditGame({ path:join(path, 'jobs.sqlite'), economy, vault:{ status:vault.status,
      attempt:(input, scope) => {
        if (input.prompt === 'DRILL_UNKNOWN_JOB') throw new Error('Simulated interruption before a confirmed job outcome.');
        return vault.attempt(input, scope);
      } } });
    const limits = createInferenceLimits({ path:join(path, 'usage.sqlite') });
    const beta = createBetaAccess({ path:join(path, 'beta.sqlite') });
    const practice = createPublicPractice({ vault, authentication, limits, beta });
    let closed = false;
    const value = { vault, economy, game, limits, beta, practice, close:() => {
      if (closed) return; game.close(); economy.close(); vault.close(); limits.close(); beta.close(); closed = true;
    } };
    bundles.push(value); return value;
  }
  try {
    const live = await bundle(source);
    const invitation = live.beta.issue({ label:'Restore fixture', days:7 }); live.beta.redeem(OWNER, invitation.code);
    const revoked = live.beta.issue({ label:'Revoked fixture', days:7 }); live.beta.revoke(revoked.id);
    live.economy.action({ action:'topup', key:'credits', amount:'1000' });
    live.economy.action({ action:'seed', key:'seed', amount:'500', roundId:'round-1' });
    const attempt = { key:'known-job', roundId:'round-1', modelId:MODEL, prompt:'DRILL_KNOWN_JOB', simulatedCredits:true };
    const known = await live.game.attempt(attempt);
    await assert.rejects(live.game.attempt({ ...attempt, key:'unknown-job', prompt:'DRILL_UNKNOWN_JOB' }), e => e.code === 'MODEL_JOB_UNCERTAIN');
    const first = await live.practice.attempt({}, { modelId:MODEL, prompt:'DRILL_FIRST_PRIVATE_MESSAGE' });
    const interrupted = createPublicPractice({ vault:live.vault, authentication, limits:{ reserve:live.limits.reserve,
      settle:() => { throw new Error('Simulated crash after receipt persistence but before usage settlement.'); } } });
    await assert.rejects(interrupted.attempt({}, { modelId:MODEL, sessionId:first.sessionId, prompt:'DRILL_SECOND_PRIVATE_MESSAGE' }), /Simulated crash/);
    assert.equal(live.limits.status(OWNER).unresolved, 1);
    live.beta.setPaused(true);
    const before = live.economy.export(); live.close();

    // All writers above are closed before copying. These paths contain drill fixtures only.
    await cp(source, backup, { recursive:true, errorOnExist:true, force:false });
    await cp(backup, restored, { recursive:true, errorOnExist:true, force:false });
    const copied = [];
    for (const name of (await readdir(source)).sort()) {
      const a = await readFile(join(source, name)), b = await readFile(join(restored, name)); assert.deepEqual(b, a);
      copied.push({ name, sha256:createHash('sha256').update(b).digest('hex') });
    }
    const databaseChecks = [];
    for (const name of (await readdir(restored)).filter(name => name.endsWith('.sqlite'))) {
      const db = new DatabaseSync(join(restored, name), { readOnly:true });
      try {
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
        databaseChecks.push({ name, integrity:'ok', foreignKeys:'ok' });
      } finally { db.close(); }
    }
    const recovery = await bundle(restored);
    assert.equal(recovery.beta.status(OWNER).admitted, true);
    assert.equal(recovery.beta.paused(), true);
    assert.throws(() => recovery.beta.redeem('player_other', revoked.code), e => e.code === 'BETA_INVITE_INVALID');
    await assert.rejects(recovery.practice.attempt({}, { modelId:MODEL, prompt:'Paused beta.' }), e => e.code === 'BETA_PAUSED');
    recovery.beta.setPaused(false);
    assert.deepEqual(recovery.economy.export(), before);
    const ledger = verifyLedgerExport(recovery.economy.export());
    const count = inputs.length;
    const replay = await recovery.game.attempt(attempt);
    assert.equal(replay.replayed, true); assert.equal(replay.receipt.id, known.receipt.id);
    assert.equal(recovery.game.result('unknown-job').status, 'unknown');
    assert.throws(() => recovery.game.reconcile('unknown-job'), e => e.code === 'MODEL_JOB_UNCERTAIN');
    await assert.rejects(recovery.practice.attempt({}, { modelId:MODEL, prompt:'Should wait for recovery.' }), e => e.code === 'ATTEMPT_BUSY');
    assert.equal(inputs.length, count);
    await assert.rejects(recovery.vault.attempt({ modelId:MODEL, sessionId:first.sessionId, prompt:'Other account.' }, { ownerId:'player_other' }), e => e.code === 'SESSION_NOT_FOUND');
    assert.equal(inputs.length, count);
    const receipts = (await readFile(join(restored, 'attempts.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const pendingReceipts = receipts.filter(r => r.usageReservationId && r.id !== first.receipt.id);
    assert.equal(pendingReceipts.length, 1);
    assert.equal(recovery.vault.receiptHistory(OWNER).records.length, 2);
    assert.equal(recovery.vault.receipt(OWNER, first.receipt.id).record.id, first.receipt.id);
    assert.throws(() => recovery.vault.receipt('player_other', first.receipt.id), e => e.code === 'RECEIPT_NOT_FOUND');
    recovery.limits.reconcile(pendingReceipts[0]); recovery.limits.reconcile(pendingReceipts[0]);
    assert.equal(recovery.limits.status(OWNER).unresolved, 0);
    assert.equal(recovery.limits.status(OWNER).reportedCostUsd, 0.004);
    await recovery.practice.attempt({}, { modelId:MODEL, sessionId:first.sessionId, prompt:'DRILL_RESUMED_PRIVATE_MESSAGE' });
    const last = inputs.at(-1);
    assert.equal(last.messages[1].content, 'DRILL_FIRST_PRIVATE_MESSAGE');
    assert.equal(last.messages[3].content, 'DRILL_SECOND_PRIVATE_MESSAGE');
    assert.equal(inputs.length, count + 1);
    assert.equal(recovery.limits.status(OWNER).reportedCostUsd, 0.006);
    const balance = account => recovery.economy.state().balances.find(row => row.account === account)?.amount ?? '0';
    assert.equal(balance('player:local-demo:available'), '800');
    assert.equal(balance('player:local-demo:reserved'), '100');
    assert.equal(balance('round:round-1:prize'), '570');
    return { createdAt:new Date().toISOString(), status:'passed', mode:'isolated-local-fixtures',
      realInferenceCalls:0, realFunds:false, realUserDataCopied:false, fixtureInferenceCalls:inputs.length,
      copied, databaseChecks, ledger, duplicateModelReplayedWithoutInference:true,
      unknownCreditJobPreserved:true, pendingUsageBlocksAfterRestore:true, receiptRecoveryIdempotent:true,
      ownerSessionResumed:true, foreignOwnerRejected:true, ownerReceiptHistoryRestored:true, usageAfterResumeUsd:0.006,
      betaAdmissionRestored:true, betaRevocationRestored:true, betaPauseRestored:true,
      limits:'A controlled stopped-writer restore drill, not a production backup, continuous replication or independent execution proof.' };
  } finally {
    for (const value of bundles) value.close();
    if (!resolve(directory).startsWith(tempRoot + sep) || !directory.includes('vault-restore-')) throw new Error('Unsafe drill cleanup path.');
    await rm(directory, { recursive:true, force:true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error('The isolated restore drill accepts no paths or live data.');
  try {
    const report = await restoreDrill(); const output = fileURLToPath(new URL('../output/', import.meta.url));
    await mkdir(output, { recursive:true }); await writeFile(join(output, 'restore-drill.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) { console.error(`Restore drill failed: ${error.message}`); process.exitCode = 1; }
}
