import { apiError, fetchJson } from './errors.mjs';

export const MODEL_SOURCE = 'https://openrouter.ai/api/v1/models';
const PREFERRED = [
  'google/gemini-2.5-flash', 'anthropic/claude-haiku-4.5',
  'qwen/qwen3.5-9b', 'qwen/qwen3.6-27b', 'openai/gpt-5-mini',
  'mistralai/mistral-small-3.2-24b-instruct', 'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat-v3.1', 'x-ai/grok-4-fast', 'z-ai/glm-4.7'
];
const COMPANIES = { qwen: 'Qwen', openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google',
  mistralai: 'Mistral', 'meta-llama': 'Meta', deepseek: 'DeepSeek', 'x-ai': 'xAI', 'z-ai': 'Z.ai' };

function selectModels(data) {
  const candidates = data.filter(model =>
    typeof model.id === 'string' && model.id.includes('/') &&
    !model.id.startsWith('~') && !/(?:^|[/:_-])latest(?:$|[/:_-])/i.test(model.id) &&
    !/(?:^openrouter\/|:free|\/auto(?:$|[-:])|router)/i.test(model.id) &&
    model.supported_parameters?.includes('tools') &&
    Number.isFinite(Number(model.pricing?.prompt)) && Number(model.pricing?.prompt) > 0 &&
    Number.isFinite(Number(model.pricing?.completion)) && Number(model.pricing?.completion) > 0
  ).map(model => ({
    id: model.id, name: model.name || model.id,
    company: COMPANIES[model.id.split('/')[0]] || model.id.split('/')[0],
    contextLength: Number.isFinite(model.context_length) ? model.context_length : null,
    inputPricePerMillion: Number((Number(model.pricing.prompt) * 1e6).toPrecision(12)),
    outputPricePerMillion: Number((Number(model.pricing.completion) * 1e6).toPrecision(12)),
    createdAt: Number.isFinite(model.created) ? new Date(model.created * 1000).toISOString() : null
  }));
  const selected = [];
  const add = model => { if (model && !selected.some(item => item.id === model.id) && selected.length < 12) selected.push(model); };
  for (const id of PREFERRED) add(candidates.find(model => model.id === id));
  const sorted = candidates.toSorted((a, b) =>
    (a.inputPricePerMillion + a.outputPricePerMillion) - (b.inputPricePerMillion + b.outputPricePerMillion) || a.id.localeCompare(b.id));
  for (const model of sorted) if (!selected.some(item => item.company === model.company)) add(model);
  for (const model of sorted) add(model);
  return selected;
}

export function createCatalog({ fetchImpl, now = Date.now, ttlMs = 300000 }) {
  let cached;
  let pending;
  return async function getModels() {
    if (cached && now() - cached.time < ttlMs) return structuredClone(cached.payload);
    if (pending) return structuredClone(await pending);
    pending = (async () => {
      try {
        const data = await fetchJson(fetchImpl, MODEL_SOURCE, { headers: { Accept: 'application/json' } }, 15000);
        if (!Array.isArray(data.data)) throw new Error('Invalid catalog');
        const models = selectModels(data.data);
        if (!models.length) throw new Error('No compatible models');
        const payload = { models, fetchedAt: new Date(now()).toISOString(), source: MODEL_SOURCE };
        cached = { time: now(), payload };
        return payload;
      } catch {
        throw apiError(503, 'CATALOG_UNAVAILABLE', 'Could not verify the current OpenRouter catalog. Model availability is unconfirmed. Please try again.');
      }
    })();
    try { return structuredClone(await pending); } finally { pending = null; }
  };
}
