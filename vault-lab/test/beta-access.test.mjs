import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createBetaAccess, BETA_MODELS } from '../server/beta-access.mjs';

const A = 'player_alice', B = 'player_bob';
const code = expected => error => error.code === expected;

test('beta invitations bind once to verified accounts without storing the invitation text', async t => {
  const root = resolve(tmpdir()), dir = await mkdtemp(join(root, 'vault-beta-'));
  assert.ok(resolve(dir).startsWith(root + sep));
  const path = join(dir, 'beta.sqlite'); let beta = createBetaAccess({ path });
  t.after(async () => { beta.close(); await rm(dir, { recursive:true, force:true }); });
  const invitation = beta.issue({ label:'tester', days:7 });
  assert.equal(beta.status(A).admitted, false);
  assert.equal(beta.redeem(A, invitation.code).admitted, true);
  assert.equal(beta.redeem(A, invitation.code).admitted, true);
  assert.throws(() => beta.redeem(B, invitation.code), code('BETA_INVITE_INVALID'));
  assert.ok(!JSON.stringify(beta.list()).includes(invitation.code));
  beta.close(); beta = createBetaAccess({ path });
  assert.equal(beta.status(A).admitted, true);
  assert.throws(() => beta.assertAccess(B), code('BETA_INVITE_REQUIRED'));
  assert.ok(!(await readFile(path)).includes(Buffer.from(invitation.code)));
});

test('expired or revoked invitations cannot admit another account or authorize an existing member', t => {
  let now = Date.UTC(2026,8,15); const beta = createBetaAccess({ now:() => now }); t.after(beta.close);
  const expired = beta.issue({ label:'expires', days:1 }); beta.redeem(A, expired.code);
  now += 86400001;
  assert.equal(beta.status(A).admitted, false);
  assert.throws(() => beta.redeem(B, expired.code), code('BETA_INVITE_INVALID'));
  const revoked = beta.issue({ label:'revoked', days:7 }); beta.redeem(B, revoked.code); beta.revoke(revoked.id);
  assert.throws(() => beta.assertAccess(B), code('BETA_INVITE_REQUIRED'));
  assert.throws(() => beta.redeem(A, revoked.code), code('BETA_INVITE_INVALID'));
});

test('pause blocks model calls but retains admission and private receipt access; only beta models can run', t => {
  const beta = createBetaAccess(); t.after(beta.close);
  beta.redeem(A, beta.issue({ label:'tester', days:7 }).code);
  beta.assertAccess(A, { write:true, modelId:BETA_MODELS[0] });
  assert.throws(() => beta.assertAccess(A, { write:true, modelId:'other/guard' }), code('BETA_MODEL_NOT_ALLOWED'));
  assert.throws(() => beta.assertAccess(A, { write:true, modelId:'qwen/qwen3.5-9b' }), code('BETA_MODEL_NOT_ALLOWED'));
  beta.setPaused(true);
  assert.equal(beta.status(A).paused, true); beta.assertAccess(A);
  assert.throws(() => beta.assertAccess(A, { write:true, modelId:BETA_MODELS[0] }), code('BETA_PAUSED'));
  beta.setPaused(false); beta.assertAccess(A, { write:true, modelId:BETA_MODELS[0] });
});

test('invalid redemption is throttled per verified account and cannot lock out another account', t => {
  let now=Date.UTC(2026,8,15); const beta=createBetaAccess({now:()=>now}); t.after(beta.close);
  for(let i=0;i<10;i++) assert.throws(()=>beta.redeem(A,'invalid'),code('BETA_INVITE_INVALID'));
  const invitation=beta.issue({label:'valid',days:7});
  assert.throws(()=>beta.redeem(A,invitation.code),code('BETA_REDEMPTION_LIMIT'));
  assert.equal(beta.redeem(B,invitation.code).admitted,true);
  now+=60001;
  assert.throws(()=>beta.redeem(A,invitation.code),code('BETA_INVITE_INVALID'));
  assert.throws(()=>beta.status('client-chosen-id'));
  assert.throws(()=>beta.issue({label:'bad',days:0}));
});

test('public beta admission does not require invitations but keeps pause and model gates', t => {
  const beta = createBetaAccess({ publicAdmission:true }); t.after(beta.close);
  assert.deepEqual(beta.status('player_public'), { required:false, admitted:true, expiresAt:null, paused:false, publicAdmission:true });
  beta.assertAccess('player_public', { write:true, modelId:BETA_MODELS[0] });
  beta.setPaused(true);
  assert.throws(() => beta.assertAccess('player_public', { write:true, modelId:BETA_MODELS[0] }), code('BETA_PAUSED'));
  beta.setPaused(false);
  assert.throws(() => beta.assertAccess('player_public', { write:true, modelId:'other/model' }), code('BETA_MODEL_NOT_ALLOWED'));
});
