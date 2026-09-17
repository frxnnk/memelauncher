import { readFile, access } from 'node:fs/promises';
import { createInferenceLimits } from '../server/limits.mjs';
import { runtimeConfiguration } from '../server/runtime.mjs';

// Operator-only local recovery; no network, inference, credits or payout actions.
try {
  const id = process.argv[2];
  if (process.argv.length !== 3 || !/^[a-f0-9-]{36}$/.test(id ?? '')) throw new Error('Usage: node --env-file-if-exists=.env scripts/reconcile-usage.mjs <usage-reservation-id>');
  const directory = new URL('../.local/', import.meta.url);
  const path = new URL('usage.sqlite', directory);
  await access(path);
  const records = (await readFile(new URL('attempts.jsonl', directory), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const receipts = records.filter(record => record.usageReservationId === id);
  if (receipts.length !== 1) throw new Error('Exactly one existing receipt must match. Missing or ambiguous evidence needs investigation; no usage was changed.');
  const { fileURLToPath } = await import('node:url');
  const limits = createInferenceLimits({ ...runtimeConfiguration(process.env), path: fileURLToPath(path) });
  try { console.log(JSON.stringify(limits.reconcile(receipts[0]), null, 2)); } finally { limits.close(); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
