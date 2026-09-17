import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchJson } from '../server/errors.mjs';
import { publicRules } from '../server/profiles.mjs';

export async function checkCandidates({ fetchImpl = fetch } = {}) {
  const source = 'https://openrouter.ai/api/v1/models';
  const catalog = await fetchJson(fetchImpl, source, { method: 'GET' }, 15000);
  if (!Array.isArray(catalog.data)) throw new Error('Invalid public catalog');
  const profiles = publicRules().profiles;
  const candidates = await Promise.all(Object.entries(profiles).map(async ([modelId, profile]) => {
    const endpointSource = `${source}/${modelId}/endpoints`;
    const result = { modelId, profile, source: endpointSource, inferenceTested: false, fundedRoundEligible: false };
    try {
      const data = await fetchJson(fetchImpl, endpointSource, { method: 'GET' }, 15000);
      const model = catalog.data.find(item => item.id === modelId);
      const slug = profile.generation.provider.only[0];
      const matches = (data.data?.endpoints ?? []).filter(e => e.tag === slug || (profile.routingScope === 'provider' && e.tag?.startsWith(`${slug}/`)));
      const required = ['tools', 'tool_choice', 'temperature', 'max_tokens', 'reasoning'];
      const routes = matches.map(endpoint => ({ slug: endpoint.tag, provider: endpoint.provider_name,
        metadataStatus: endpoint.status, missingParameters: required.filter(p => !endpoint.supported_parameters?.includes(p)),
        pricingPerToken: endpoint.pricing ?? null, contextLength: endpoint.context_length ?? null }));
      const compatible = Boolean(model && model.reasoning?.mandatory !== true && routes.some(e => e.metadataStatus === 0 && !e.missingParameters.length));
      return { ...result, status: compatible ? 'request-compatible-by-metadata' : 'not-confirmed',
        reasoningMetadata: model?.reasoning ?? null, routes };
    } catch (error) { return { ...result, status: 'source-error', errorCode: error.code ?? 'CATALOG_ERROR' }; }
  }));
  return { checkedAt: new Date().toISOString(), source, inferenceRequests: 0, candidates,
    limitation: 'Public GET metadata only. No authentication, inference, latency, resistance or operator-independent execution was tested.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkCandidates().then(result => console.log(JSON.stringify(result, null, 2))).catch(() => {
    console.error('Could not verify the public model catalog. Availability remains unknown.'); process.exitCode = 1;
  });
}
