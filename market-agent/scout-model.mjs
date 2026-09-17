import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { validateShape } from './scout-schema.mjs';

export function modelArgs(schemaFile, outputFile, directory, search) {
  return [...(search ? ['--search'] : []), '-a', 'never',
    ...['shell_tool', 'apps', 'plugins', 'hooks', 'multi_agent', 'multi_agent_v2', 'computer_use',
      'browser_use', 'browser_use_external', 'in_app_browser', 'image_generation', 'view_image'].flatMap(name => ['--disable', name]),
    'exec', '--ignore-user-config', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check',
    '-c', 'features.skip_host_skill_discovery=true',
    '-c', 'model_reasoning_effort="high"', '-c', 'web_search=' + (search ? '"live"' : '"disabled"'),
    '--color', 'never', '--json', '--output-schema', schemaFile, '--output-last-message', outputFile, '-C', directory, '-'];
}

export async function runProcess(binary, args, prompt, { spawnImpl = spawn, timeoutMs = 600_000, maxBytes = 6_000_000,
  onEvent = () => {}, maxSearchCalls = 16 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(binary, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', pending = '', failure = null, searches = 0;
    const outDecoder = new StringDecoder('utf8'), errDecoder = new StringDecoder('utf8');
    const stop = reason => { failure ??= reason; child.kill(); };
    const cancelled = () => stop('MODEL_CANCELLED');
    process.once('SIGINT', cancelled); process.once('SIGTERM', cancelled);
    const cleanup = () => { clearTimeout(timer); process.removeListener('SIGINT', cancelled); process.removeListener('SIGTERM', cancelled); };
    const timer = setTimeout(() => stop('MODEL_TIMEOUT'), timeoutMs);
    child.on('error', error => { cleanup(); reject(new Error(error.code === 'ENOENT' ? 'CODEX_NOT_FOUND' : 'MODEL_START_FAILED')); });
    child.stdout.on('data', bytes => {
      if (failure) return;
      const chunk = outDecoder.write(bytes); stdout += chunk; pending += chunk;
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maxBytes) stop('MODEL_OUTPUT_LIMIT');
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) {
        let event; try { event = JSON.parse(line); } catch { continue; }
        if (['item.started', 'item.completed'].includes(event.type)
          && ['command_execution', 'file_change', 'mcp_tool_call'].includes(event.item?.type)) stop('MODEL_UNEXPECTED_TOOL');
        if (event.type === 'item.started' && event.item?.type === 'web_search' && ++searches > maxSearchCalls) stop('MODEL_SEARCH_LIMIT');
        onEvent(event);
      }
    });
    child.stderr.on('data', bytes => { stderr += errDecoder.write(bytes); if (Buffer.byteLength(stderr) > maxBytes) stop('MODEL_OUTPUT_LIMIT'); });
    child.on('close', code => { cleanup(); stdout += outDecoder.end(); stderr += errDecoder.end(); resolve({ code, stdout, stderr, failure }); });
    child.stdin.on('error', () => {}); // A startup/auth failure may close stdin before the prompt is consumed.
    child.stdin.end(prompt);
  });
}

export async function codexModel({ stage, prompt, schema, directory, search = false, onProgress = () => {}, processRunner = runProcess }) {
  if (!['discovery', 'review'].includes(stage)) throw new Error('Unknown model stage');
  const schemaFile = path.join(directory, `${stage}.schema.json`), outputFile = path.join(directory, `${stage}.model.json`);
  await writeFile(schemaFile, JSON.stringify(schema), { flag: 'wx' });
  await writeFile(path.join(directory, `${stage}.prompt.txt`), prompt, { flag: 'wx' });
  const result = await processRunner(process.env.RADAR_CODEX_BIN || 'codex', modelArgs(schemaFile, outputFile, directory, search), prompt,
    { onEvent: event => {
      if (event.item?.type === 'web_search' && event.type === 'item.completed') onProgress({ stage, activity: 'web_search_completed' });
    } });
  await writeFile(path.join(directory, `${stage}.events.jsonl`), result.stdout, { flag: 'wx' });
  // Diagnostics can contain local paths but never deliberately read or persist credential files.
  await writeFile(path.join(directory, `${stage}.stderr.txt`), result.stderr, { flag: 'wx' });
  if (result.failure || result.code !== 0) throw new Error(result.failure || 'MODEL_PROCESS_FAILED');
  const events = result.stdout.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return {}; } });
  if (!events.some(e => e.type === 'turn.completed') || events.some(e => ['turn.failed', 'error'].includes(e.type))) throw new Error('MODEL_TURN_INCOMPLETE');
  const searchEvents = events.filter(e => e.type === 'item.completed' && e.item?.type === 'web_search');
  if (search && !searchEvents.length) throw new Error('MODEL_DID_NOT_SEARCH');
  const output = validateShape(JSON.parse(await readFile(outputFile, 'utf8')), schema);
  return { output, provenance: { runtime: 'codex-cli', stage, searchEvents: searchEvents.length,
    usage: events.filter(e => e.type === 'turn.completed').map(e => e.usage),
    completedAt: new Date().toISOString(), sourceContentVerification: 'Model-reported reading; inspect archived web events for access evidence.' } };
}
