import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectMarket } from './collect.mjs';
import { analyzeMarket, renderReport } from './analyze.mjs';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.join(workspace, 'output', 'market-agent');
const chainPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const help = `Market research and local draft preparation. No token is launched.

Usage:
  node market-agent/cli.mjs scan [--query text] [--chain solana] [--limit 6]
  node market-agent/cli.mjs prepare input.json
  node market-agent/cli.mjs --help

Repeat --query up to 8 times. --limit must be 1..8.
prepare requires name, ticker, thesis, sourceUrls, createdFromReport, and chain.
createdFromReport must point to an existing decision.json under output/market-agent.
Outputs are new local files. Provider errors retain results and return exit code 2.
`;

function fail(message) {
  throw new Error(message);
}

function validChain(value) {
  return typeof value === 'string' && value.length <= 32 && chainPattern.test(value);
}

export function parseScanArgs(args) {
  const options = { queries: [], chain: undefined, limit: 6 };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!['--query', '--chain', '--limit'].includes(flag)) fail(`Unknown scan option: ${flag}`);
    if (flag !== '--query' && seen.has(flag)) fail(`Repeated option: ${flag}`);
    seen.add(flag);
    const value = args[++index];
    if (typeof value !== 'string' || value.startsWith('--')) fail(`Missing value for ${flag}`);
    if (flag === '--query') {
      if (!value.trim() || value.length > 160) fail('Each query must contain 1..160 characters.');
      options.queries.push(value.trim());
      if (options.queries.length > 8) fail('At most 8 queries are allowed.');
    } else if (flag === '--chain') {
      if (!validChain(value)) fail('Chain must be a lowercase identifier of at most 32 characters.');
      options.chain = value;
    } else {
      if (!/^[1-8]$/.test(value)) fail('Limit must be an integer from 1 to 8.');
      options.limit = Number(value);
    }
  }
  return options;
}

function containedBy(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function requiredText(input, key, maxLength) {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    fail(`${key} must contain 1..${maxLength} characters.`);
  }
  return value.trim();
}

export async function validateConcept(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Concept must be a JSON object.');
  const name = requiredText(input, 'name', 64);
  const ticker = input.ticker;
  if (typeof ticker !== 'string' || !/^[A-Z0-9]{2,10}$/.test(ticker)) {
    fail('ticker must contain 2..10 uppercase ASCII letters or digits.');
  }
  const thesis = requiredText(input, 'thesis', 4000);
  if (!validChain(input.chain)) fail('chain must be a lowercase identifier of at most 32 characters.');
  if (!Array.isArray(input.sourceUrls) || input.sourceUrls.length === 0) {
    fail('sourceUrls must contain at least one HTTPS evidence URL.');
  }
  const sourceUrls = input.sourceUrls.map((value) => {
    let url;
    try { url = typeof value === 'string' ? new URL(value) : undefined; } catch { /* Invalid below. */ }
    if (!url || url.protocol !== 'https:' || url.username || url.password) {
      fail('Every sourceUrls entry must be an HTTPS URL without credentials.');
    }
    return url.href;
  });
  const reportPath = input.createdFromReport;
  if (typeof reportPath !== 'string' || !path.isAbsolute(reportPath)
    || path.basename(reportPath) !== 'decision.json') {
    fail('createdFromReport must be an absolute path to decision.json.');
  }
  const [realRoot, realReport] = await Promise.all([realpath(outputRoot), realpath(reportPath)]);
  if (!containedBy(realRoot, realReport) || path.basename(realReport) !== 'decision.json') {
    fail('createdFromReport must resolve inside output/market-agent.');
  }
  if (!(await stat(realReport)).isFile()) fail('createdFromReport must be a file.');
  const evidence = JSON.parse(await readFile(realReport, 'utf8'));
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    fail('The evidence report must be a JSON object.');
  }
  const concept = { name, ticker, thesis, sourceUrls, createdFromReport: realReport, chain: input.chain };
  for (const key of ['assets', 'metadata']) {
    if (input[key] !== undefined) {
      if (!input[key] || typeof input[key] !== 'object') fail(`${key} must contain JSON metadata.`);
      concept[key] = input[key];
    }
  }
  return concept;
}

async function previousScan() {
  let entries;
  try { entries = await readdir(outputRoot, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return { raw: undefined, warnings: [] };
    throw error;
  }
  const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const scanPath = path.join(outputRoot, entry.name, 'scan.json');
    try {
      const info = await stat(scanPath);
      return info.isFile() ? { scanPath, modified: info.mtimeMs } : undefined;
    } catch (error) {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    }
  }));
  const warnings = [];
  for (const candidate of candidates.filter(Boolean).sort((a, b) => b.modified - a.modified)) {
    try {
      const raw = JSON.parse(await readFile(candidate.scanPath, 'utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)
        || !Number.isFinite(Date.parse(raw.observedAt))) throw new Error('Expected a dated snapshot object.');
      return { raw, path: candidate.scanPath, warnings };
    } catch (error) {
      warnings.push(`Skipped unreadable prior scan ${candidate.scanPath}: ${error.message}`);
    }
  }
  return { raw: undefined, warnings };
}

async function newDirectory(prefix = '') {
  await mkdir(outputRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = path.join(outputRoot, `${prefix}${stamp}-${randomUUID()}`);
  await mkdir(directory);
  return directory;
}

async function writeJson(destination, value) {
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', encoding: 'utf8' });
}

async function scan(options) {
  const previous = await previousScan();
  const raw = await collectMarket(options);
  const report = analyzeMarket(raw, previous.raw);
  const directory = await newDirectory();
  const files = {
    scan: path.join(directory, 'scan.json'),
    decision: path.join(directory, 'decision.json'),
    report: path.join(directory, 'REPORT.md'),
  };
  await writeJson(files.scan, raw);
  await writeJson(files.decision, report);
  await writeFile(files.report, renderReport(report), { flag: 'wx', encoding: 'utf8' });
  const errors = Array.isArray(raw.errors) ? raw.errors : (report.errors ?? []);
  const narratives = (report.narratives ?? []).map((item) => ({
    name: item.name ?? item.title ?? item.narrative,
    decision: item.decision ?? item.status,
    observedTokens: item.observedTokens,
    activeTokens: item.activeTokens,
  }));
  console.log(JSON.stringify({ files, launchDecision: report.launchDecision,
    previousScan: previous.path ?? null, errors, warnings: previous.warnings, narratives }));
  return errors.length > 0 ? 2 : 0;
}

async function prepare(inputPath) {
  const input = JSON.parse(await readFile(path.resolve(inputPath), 'utf8'));
  const concept = await validateConcept(input);
  const createdAt = new Date().toISOString();
  const directory = await newDirectory('draft-');
  const files = { metadata: path.join(directory, 'metadata.json'), proposal: path.join(directory, 'proposal.json') };
  await writeJson(files.metadata, { name: concept.name, symbol: concept.ticker, description: concept.thesis });
  await writeJson(files.proposal, {
    status: 'DRAFT_REQUIRES_REVIEW', concept, createdAt,
    evidenceReport: concept.createdFromReport, launchAuthorized: false,
    unresolved: ['independent social demand', 'exact token/pool competition', 'creator and distribution plan',
      'platform quote and simulation', 'budget and fees'],
  });
  console.log(JSON.stringify({ status: 'DRAFT_REQUIRES_REVIEW', launchAuthorized: false, files }));
  return 0;
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 0 || (args.length === 1 && ['--help', '-h', 'help'].includes(args[0]))) {
    console.log(help);
    return 0;
  }
  const [command, ...rest] = args;
  if (command === 'scan') return scan(parseScanArgs(rest));
  if (command === 'prepare') {
    if (rest.length !== 1 || rest[0].startsWith('-')) fail('prepare requires exactly one input JSON path.');
    return prepare(rest[0]);
  }
  fail(`Unknown command: ${command}. Use --help.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
  });
}
