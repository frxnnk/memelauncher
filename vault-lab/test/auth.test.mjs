import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createAuthentication } from '../server/auth.mjs';
import { createHttpServer } from '../server/http.mjs';
import { resolve } from 'node:path';

const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const config = { appId: 'vault-test-app', clientId: 'vault-test-client', verificationKey: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
const timestamp = Math.floor(Date.now() / 1000);
const claims = { iss: 'privy.io', aud: config.appId, sub: 'did:privy:fixture-user', sid: 'fixture-session', iat: timestamp, exp: timestamp + 300 };
function token(extra = {}, key = keys.privateKey) {
  const encoded = [Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ ...claims, ...extra })).toString('base64url')].join('.');
  return encoded + '.' + sign('sha256', Buffer.from(encoded), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
const headers = extra => ({ authorization: `Bearer ${token(extra)}` });

test('missing Privy settings disable auth without pretending the SDK is configured', async () => {
  const auth = createAuthentication();
  assert.equal(auth.publicConfig().configured, false);
  await assert.rejects(auth.authenticate(headers()), error => error.code === 'AUTH_NOT_CONFIGURED');
  assert.ok(!JSON.stringify(createAuthentication(config).publicConfig()).includes('BEGIN PUBLIC KEY'));
});

test('official SDK verifies ES256 identity; arbitrary wallet headers confer no ownership', async () => {
  const auth = createAuthentication(config);
  const identity = await auth.authenticate({ ...headers(), 'x-wallet-address': '0x' + 'a'.repeat(40) });
  assert.match(identity.accountId, /^player_[a-f0-9]{48}$/);
  assert.deepEqual(identity.wallets, []);
  assert.equal(identity.walletOwnershipVerified, false);
  assert.equal(identity.realFunds, false);
  assert.notEqual((await auth.authenticate(headers({ sub: 'did:privy:other' }))).accountId, identity.accountId);
  assert.equal((await auth.authenticate(headers())).accountId, identity.accountId);
});

test('expired, foreign-app, wrong issuer, future and unsigned tokens are rejected without returning secrets', async () => {
  const auth = createAuthentication(config);
  for (const overrides of [{ exp: timestamp - 10 }, { aud: 'another-app' }, { iss: 'untrusted.invalid' },
    { iat: timestamp + 3600 }, { sid: null }, { sub: 'player-claimed-by-client' }]) {
    await assert.rejects(auth.authenticate(headers(overrides)), error => error.status === 401 && !error.message.includes('eyJ'));
  }
  const foreign = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  await assert.rejects(auth.authenticate({ authorization: 'Bearer ' + token({}, foreign.privateKey) }), error => error.status === 401);
  await assert.rejects(auth.authenticate({ authorization: 'Bearer unsigned.payload.signature' }), error => error.status === 401);
  await assert.rejects(auth.authenticate({}), error => error.status === 401);
});

test('wallet ownership requires a signed identity token for the same authenticated user', async () => {
  const auth = createAuthentication(config);
  const wallet = { type: 'wallet', wallet_client_type: 'privy', chain_type: 'ethereum', address: '0x' + 'A'.repeat(40), lv: timestamp };
  const identity = token({ linked_accounts: JSON.stringify([wallet, wallet]), cr: String(timestamp), guest: 'f' });
  const result = await auth.authenticate({ ...headers(), 'x-privy-identity-token': identity });
  assert.equal(result.wallets.length, 1); assert.equal(result.walletOwnershipVerified, true);
  assert.equal(result.wallets[0].address, '0x' + 'a'.repeat(40));
  await assert.rejects(auth.authenticate({ ...headers({ sub: 'did:privy:another-user' }), 'x-privy-identity-token': identity }), error => error.status === 401);
});

test('HTTP account endpoint is private and config does not disclose the verifier or a bearer token', async t => {
  const server = createHttpServer({ service: {}, publicDir: resolve('public'), authentication: createAuthentication(config) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(origin + '/api/auth/config');
  assert.equal((await response.json()).configured, true);
  assert.ok(response.headers.get('content-security-policy').includes('frame-src https://auth.privy.io;'));
  assert.equal((await fetch(origin + '/api/account')).status, 401);
  const account = await fetch(origin + '/api/account', { headers: headers() });
  assert.equal(account.status, 200);
  const text = await account.text();
  assert.ok(!text.includes('eyJ') && !text.includes('BEGIN PUBLIC KEY') && !text.includes('did:privy:fixture-user'));
});
