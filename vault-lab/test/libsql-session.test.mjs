import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibsqlSession } from '../server/storage/libsql-session.mjs';

function fakeClient() {
  const calls = [];
  const tx = {
    executeMultiple: async sql => { calls.push({ target: 'tx', op: 'executeMultiple', sql }); },
    execute: async stmt => {
      calls.push({ target: 'tx', op: 'execute', sql: stmt.sql, args: stmt.args });
      return { rows: [{ user_version: 6 }], columns: ['user_version'], rowsAffected: 0, lastInsertRowid: 0n };
    },
    commit: async () => { calls.push({ target: 'tx', op: 'commit' }); },
    rollback: async () => { calls.push({ target: 'tx', op: 'rollback' }); }
  };
  return {
    calls,
    transaction: async mode => {
      calls.push({ target: 'client', op: 'transaction', mode });
      return tx;
    },
    executeMultiple: async sql => { calls.push({ target: 'client', op: 'executeMultiple', sql }); },
    execute: async stmt => {
      calls.push({ target: 'client', op: 'execute', sql: stmt.sql, args: stmt.args });
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: 0n };
    },
    close: async () => { calls.push({ target: 'client', op: 'close' }); }
  };
}

test('BEGIN IMMEDIATE keeps later statements on the same libsql transaction stream', async () => {
  const client = fakeClient();
  const session = createLibsqlSession(client);
  await session.handle({ type: 'exec', sql: 'PRAGMA busy_timeout=3000; BEGIN IMMEDIATE' });
  const selected = await session.handle({ type: 'get', sql: 'SELECT 1 AS user_version', args: [] });
  await session.handle({ type: 'exec', sql: 'COMMIT' });
  assert.equal(selected.row.user_version, 6);
  assert.deepEqual(client.calls.map(call => [call.target, call.op]), [
    ['client', 'transaction'],
    ['tx', 'execute'],
    ['tx', 'commit']
  ]);
  assert.equal(client.calls[0].mode, 'write');
});

test('ROLLBACK without an open transaction is a no-op so catch blocks keep the original error', async () => {
  const client = fakeClient();
  const session = createLibsqlSession(client);
  await assert.doesNotReject(() => session.handle({ type: 'exec', sql: 'ROLLBACK' }));
  assert.deepEqual(client.calls, []);
});

test('schema exec without BEGIN still uses the client stream', async () => {
  const client = fakeClient();
  const session = createLibsqlSession(client);
  await session.handle({ type: 'exec', sql: 'CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)' });
  assert.deepEqual(client.calls.map(call => [call.target, call.op]), [['client', 'executeMultiple']]);
});
