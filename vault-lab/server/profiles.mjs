import { GENERATION, RULES } from './rules.mjs';

export const CONFIGURATION_VERSION = 'vault-candidate-profiles-v2-2026-09-15';
// Live practice checks do not qualify these candidates for funded rounds.
const ROUTES = {
  'qwen/qwen3.5-9b': { slug: 'deepinfra/bf16', scope: 'endpoint' },
  'qwen/qwen3.6-27b': { slug: 'chutes/fp8', scope: 'endpoint' },
  'google/gemini-2.5-flash': { slug: 'google-vertex/global', scope: 'endpoint' },
  'anthropic/claude-haiku-4.5': { slug: 'anthropic', scope: 'provider' },
  'anthropic/claude-opus-5': { slug: 'anthropic', scope: 'provider' }
};

export function hasPublishedRoute(modelId) {
  return Object.hasOwn(ROUTES, modelId);
}

export function modelConfiguration(modelId) {
  const route = ROUTES[modelId];
  return {
    version: CONFIGURATION_VERSION, status: 'candidate-not-qualified-for-prizes',
    routingScope: route?.scope ?? 'router',
    generation: route ? { ...structuredClone(GENERATION), reasoning: { enabled: false },
      provider: { ...GENERATION.provider, only: [route.slug], order: [route.slug] } } : structuredClone(GENERATION),
    note: route
      ? `Requests are restricted to the ${route.scope} slug ${route.slug}, with no fallback and reasoning explicitly disabled. Routing is requested through OpenRouter; execution, exact weights and successful inference are not independently verified.`
      : 'This model uses the baseline router configuration. Provider and reasoning defaults are not calibrated; it is not eligible for a funded round.'
  };
}

export function publicRules(evaluationPrompt = null) {
  if (evaluationPrompt !== null && (!evaluationPrompt || typeof evaluationPrompt !== 'object' ||
      Object.keys(evaluationPrompt).sort().join(',') !== 'systemPrompt,version' ||
      typeof evaluationPrompt.version !== 'string' || !/^eval-[a-z0-9-]{1,80}$/.test(evaluationPrompt.version) ||
      typeof evaluationPrompt.systemPrompt !== 'string' || !evaluationPrompt.systemPrompt.trim() || evaluationPrompt.systemPrompt.length > 6000)) {
    throw new Error('An evaluation prompt needs an explicit eval-prefixed version and 1–6,000 characters.');
  }
  return structuredClone({ ...RULES, ...(evaluationPrompt ?? {}), generation: GENERATION, configurationVersion: CONFIGURATION_VERSION,
    profiles: Object.fromEntries(Object.keys(ROUTES).map(modelId => [modelId, modelConfiguration(modelId)])),
    profilePolicy: 'The selected model profile overrides the baseline generation object. All profiles are public candidates; no model is qualified for real money.' });
}
