import { parentPort, workerData } from 'node:worker_threads';
import { Buffer } from 'node:buffer';
import { createLibsqlSession } from './libsql-session.mjs';

const { config, sab } = workerData;
const lock = new Int32Array(sab, 0, 2);
const SLOT = 8;
let session;

function reply(value) {
  const encoded = Buffer.from(JSON.stringify(value));
  new Uint8Array(sab).set(encoded, SLOT);
  Atomics.store(lock, 1, encoded.byteLength);
  Atomics.store(lock, 0, 0);
  Atomics.notify(lock, 0);
}

async function handle(message) {
  if (!session) {
    const { createClient } = await import('@libsql/client');
    session = createLibsqlSession(createClient(config));
  }
  return session.handle(message);
}

parentPort.on('message', async message => {
  try { reply(await handle(message)); }
  catch (error) { reply({ ok: false, message: error.message }); }
});
