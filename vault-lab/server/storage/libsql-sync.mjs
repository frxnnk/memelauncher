import { Worker } from 'node:worker_threads';
import { Buffer } from 'node:buffer';

const SLOT = 8;
const CAPACITY = 2 * 1024 * 1024;

export function createLibsqlSync(config) {
  const sab = new SharedArrayBuffer(SLOT + CAPACITY);
  const lock = new Int32Array(sab, 0, 2);
  const worker = new Worker(new URL('./libsql-worker.mjs', import.meta.url), {
    workerData: { config, sab }
  });
  worker.on('error', error => {
    Atomics.store(lock, 1, 0);
    Atomics.store(lock, 0, 0);
    Atomics.notify(lock, 0);
    throw new Error(error?.message || 'The libsql worker failed.');
  });
  let closed = false;
  function call(message) {
    if (closed) throw new Error('The libsql connection is closed.');
    Atomics.store(lock, 0, 1);
    worker.postMessage(message);
    const wait = Atomics.wait(lock, 0, 1, 30_000);
    if (wait === 'timed-out') throw new Error('The libsql worker timed out.');
    const length = Atomics.load(lock, 1);
    const payload = Buffer.from(new Uint8Array(sab, SLOT, length)).toString('utf8');
    const parsed = JSON.parse(payload);
    if (!parsed.ok) throw new Error(parsed.message);
    return parsed;
  }
  return {
    exec(sql) { call({ type: 'exec', sql }); },
    prepare(sql) {
      return {
        get: (...args) => call({ type: 'get', sql, args }).row ?? undefined,
        all: (...args) => call({ type: 'all', sql, args }).rows,
        run: (...args) => {
          const result = call({ type: 'run', sql, args });
          return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
        }
      };
    },
    close() {
      if (closed) return;
      closed = true;
      try { call({ type: 'close' }); } catch { /* worker may already be gone */ }
      worker.terminate();
    }
  };
}
