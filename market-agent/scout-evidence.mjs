import { discoverySchema, reviewSchema, validateShape } from './scout-schema.mjs';
import { parseInstant, sourceKey } from './sightings.mjs';
import { makeDecisionRecord } from './ideas.mjs';

function publicationFields(value, observedAt) {
  if (value === null) return { publishedAt: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Validate the calendar only; midnight is NOT persisted as an observed publication time.
    if (parseInstant(value + 'T00:00:00Z') > parseInstant(observedAt) + 86_400_000) throw new Error('Source published in the future');
    return { publishedAt: null, publishedDate: value };
  }
  if (parseInstant(value) > parseInstant(observedAt)) throw new Error('Source published in the future');
  return { publishedAt: value };
}

export function validateDiscovery(input, observedAt) {
  validateShape(input, discoverySchema);
  const now = parseInstant(observedAt), sources = new Map(), stories = new Set(), ideas = new Set();
  for (const source of input.sources) {
    if (sources.has(source.id)) throw new Error('Duplicate source ID');
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')
      || /^(localhost|127\.|0\.|10\.|192\.168\.|\[)/i.test(url.hostname)) throw new Error('Invalid public evidence URL');
    sourceKey(source.url);
    if (source.kind === 'x_post' && !/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/(?:[^/]+\/status|i\/web\/status)\/\d+(?:[/?#]|$)/.test(source.url)) throw new Error('X evidence requires a post URL');
    publicationFields(source.publishedAt, observedAt);
    sources.set(source.id, source);
  }
  for (const story of input.stories) {
    if (stories.has(story.id)) throw new Error('Duplicate story ID');
    stories.add(story.id);
    if (new Set(story.sourceIds).size !== story.sourceIds.length) throw new Error('Duplicate story source');
    for (const id of story.sourceIds) if (!sources.has(id)) throw new Error('Unknown story source');
    if (story.queries.some(q => q.trim() !== q)) throw new Error('Queries must be trimmed');
    if (new Set(story.interpretations.map(i => i.angle)).size < 2) throw new Error('Interpretations need different angles');
    for (const idea of story.interpretations) {
      if (ideas.has(idea.id)) throw new Error('Duplicate idea ID');
      ideas.add(idea.id);
      if (idea.basisEvidenceIds.some(id => !story.sourceIds.includes(id))) throw new Error('Idea source outside story');
    }
  }
  if (!input.stories.length && !input.abstentionReason.trim()) throw new Error('Empty discovery requires abstention reason');
  return input;
}

export function marketContext(raw) {
  return { observedAt: raw.observedAt, coverage: raw.coverage, errors: raw.errors,
    searches: raw.searches.map(s => ({ query: s.query, collectionError: s.collectionError ?? null,
      // Raw responses remain on disk. Bounded excerpts prevent keyword stuffing from exhausting the model context.
      pairs: s.pairs.slice(0, 30).map(p => ({ chainId: p.chainId, pairAddress: p.pairAddress,
        baseToken: { address: p.baseToken?.address, name: String(p.baseToken?.name ?? '').slice(0, 180), symbol: String(p.baseToken?.symbol ?? '').slice(0, 80) },
        quoteToken: { address: p.quoteToken?.address, symbol: String(p.quoteToken?.symbol ?? '').slice(0, 80) },
        liquidity: p.liquidity ?? null, volume: p.volume ?? null, pairCreatedAt: p.pairCreatedAt ?? null,
        url: p.url, info: { websites: (p.info?.websites ?? []).slice(0, 3), socials: (p.info?.socials ?? []).slice(0, 3) } })) })) };
}

export function buildScoutResult(discovery, review, raw, { observedAt, completedAt, previousSources = [] }) {
  validateDiscovery(discovery, observedAt); validateShape(review, reviewSchema);
  if (parseInstant(completedAt) < parseInstant(observedAt)) throw new Error('Clock moved backwards');
  const memory = new Map(previousSources.map(source => [source.key, { ...source }]));
  for (const source of memory.values()) if (source.firstSeenAt !== null && parseInstant(source.firstSeenAt) > parseInstant(observedAt)) throw new Error('Previous source from the future');
  const sources = discovery.sources.map(source => {
    const key = sourceKey(source.url), old = memory.get(key);
    const item = { key, url: source.url, firstSeenAt: old ? old.firstSeenAt : observedAt, lastSeenAt: observedAt };
    memory.set(key, item);
    return { ...source, ...publicationFields(source.publishedAt, observedAt), ...item, observedAt, provenance: 'Model-reported web reading, not independent fact verification' };
  });
  const sourceById = new Map(sources.map(s => [s.id, s])), reviews = new Map();
  const validIdeas = new Set(discovery.stories.flatMap(s => s.interpretations.map(i => `${s.id}/${i.id}`)));
  for (const r of review.reviews) {
    const key = `${r.storyId}/${r.ideaId}`;
    if (!validIdeas.has(key) || reviews.has(key)) throw new Error('Unknown or duplicate review');
    reviews.set(key, r);
  }
  if (reviews.size !== validIdeas.size) throw new Error('Missing idea review');
  const stories = discovery.stories.map(story => {
    const evidence = story.sourceIds.map(id => sourceById.get(id));
    // The first source identifies the event. Older context/replies must not backdate this story.
    const primary = evidence[0];
    const publication = primary.publishedAt;
    const checks = raw.searches.filter(s => story.queries.includes(s.query));
    const interpretations = story.interpretations.map(idea => {
      const r = reviews.get(`${story.id}/${idea.id}`);
      for (const query of r.queryEvidence) if (!checks.some(s => s.query === query)) throw new Error('Review cites unperformed query');
      for (const pair of r.relatedPairs) if (!checks.filter(s => r.queryEvidence.includes(s.query)).some(s => s.pairs.some(p => p.chainId === pair.chainId && p.pairAddress === pair.pairAddress))) throw new Error('Review cites unknown pool');
      if (r.competitionStatus === 'represented' && !r.relatedPairs.length) throw new Error('Represented competition needs pool evidence');
      if (r.competitionStatus !== 'not_checked' && !checks.some(s => r.queryEvidence.includes(s.query) && !s.collectionError)) throw new Error('Competition requires successful query');
      const limitations = [];
      if (!evidence.some(s => s.kind === 'x_post')) limitations.push('Sin publicación de X documentada: interpretación propuesta, recepción social pendiente.');
      if (!evidence.some(s => s.access === 'full_text')) limitations.push('Solo hay extractos de búsqueda; falta lectura de la fuente.');
      if (story.visualEssential && !evidence.some(s => s.media === 'inspected')) limitations.push('El gesto visual esencial no se pudo inspeccionar.');
      const missingContent = !evidence.some(s => s.access === 'full_text') || (story.visualEssential && !evidence.some(s => s.media === 'inspected'));
      return { ...idea, ...r, disposition: r.disposition === 'EXPLORE' && missingContent ? 'REWORK' : r.disposition,
        decisionReason: [r.decisionReason, ...limitations].join(' '), relatedMarketNodeIds: [],
        evidence: idea.basisEvidenceIds.map(id => ({ label: `${sourceById.get(id).author} · ${sourceById.get(id).access}`, url: sourceById.get(id).url })),
        marketEvidence: r.queryEvidence.map(query => ({ label: `Consulta acotada: ${query}`, url: 'https://dexscreener.com/search?q=' + encodeURIComponent(query) })) };
    });
    return { ...story, mode: 'snapshot', shortTitle: story.title, interpretations,
      publishedAt: publication, publishedDate: primary.publishedDate ?? null, firstSeenAt: primary.firstSeenAt, firstLaunchAt: null,
      firstMarketObservedAt: checks.some(s => !s.collectionError) ? raw.observedAt : null,
      evidence: evidence.map(s => ({ label: `${s.author} · ${s.access}`, url: s.url })),
      rootNote: 'Fuentes y lectura cultural · corrida autónoma', stageLabel: 'Propuesta del modelo · evidencia acotada',
      timingNote: 'Primera detección = primera lectura documentada por este radar, no primera aparición global. Publicación informada por el modelo desde la fuente. ' + discovery.coverageNote };
  });
  const catalog = { version: 1, generatedAt: completedAt, stories, evidence: sources };
  const decisions = stories.length ? makeDecisionRecord(catalog) : { version: 1, generatedAt: completedAt, executionAuthorized: false, stories: [] };
  const byIdea = new Map(decisions.stories.flatMap(s => s.decisions.map(d => [d.ideaId, d])));
  for (const story of stories) for (const idea of story.interpretations) {
    idea.decision = byIdea.get(idea.id);
    idea.buildLabel = { hours: 'Horas', days: 'Días', unknown: 'Por estimar' }[idea.buildEstimate];
  }
  return { catalog, decisions, sources: [...memory.values()], map: { version: 2, generatedAt: completedAt,
    sourceObservedAt: observedAt, selectedStoryId: stories[0]?.id ?? null, stories, followup: null },
    summary: review.summary, coverageNote: discovery.coverageNote, abstentionReason: discovery.abstentionReason };
}
