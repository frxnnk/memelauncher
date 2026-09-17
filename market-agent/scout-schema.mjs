const text = { type: 'string', minLength: 1, maxLength: 2400 };
const id = { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,79}$' };
const choice = values => ({ type: 'string', enum: values });
const list = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const brief = object({ id, title: text, angle: choice(['association', 'character', 'mechanic', 'cultural']),
  pitch: text, whatItDoes: text, whyNow: text, distinctiveElement: text, minimumBuild: text,
  buildEstimate: choice(['hours', 'days', 'unknown']), quickCheck: text, discardIf: text,
  basisEvidenceIds: list(id, 6, 1) });
export const discoverySchema = object({ coverageNote: text, abstentionReason: { type: 'string', maxLength: 2400 },
  sources: list(object({ id, url: { type: 'string', maxLength: 2000 }, title: text, author: text,
    publishedAt: { type: ['string', 'null'] }, excerpt: text,
    kind: choice(['news', 'x_post', 'commentary']), access: choice(['full_text', 'search_excerpt']),
    media: choice(['inspected', 'not_inspected', 'not_applicable']) }), 12),
  stories: list(object({ id, title: text, summary: text, meme: text, gap: text,
    sourceIds: list(id, 6, 1), queries: list({ type: 'string', minLength: 1, maxLength: 100 }, 2, 1),
    visualEssential: { type: 'boolean' }, interpretations: list(brief, 3, 2) }), 3) });
export const reviewSchema = object({ summary: text, reviews: list(object({ storyId: id, ideaId: id,
  disposition: choice(['EXPLORE', 'REWORK', 'PASS']), decisionReason: text,
  competitionStatus: choice(['represented', 'partial', 'not_checked']), competitionNote: text,
  queryEvidence: list({ type: 'string', maxLength: 100 }, 2),
  relatedPairs: list(object({ chainId: { type: 'string', maxLength: 50 },
    pairAddress: { type: 'string', maxLength: 150 } }), 6) }), 9) });

// Validate model outputs as well as requesting structured output from the provider.
export function validateShape(value, schema, label = 'output') {
  const types = [].concat(schema.type);
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (!types.includes(type)) throw new Error(`Invalid ${label}: expected ${types.join('/')}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`Invalid ${label}: enum`);
  if (type === 'string') {
    if ((schema.minLength && value.trim().length < schema.minLength) || value.length > (schema.maxLength ?? Infinity)
      || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw new Error(`Invalid ${label}: string`);
  }
  if (type === 'array') {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) throw new Error(`Invalid ${label}: length`);
    value.forEach((entry, i) => validateShape(entry, schema.items, `${label}.${i}`));
  }
  if (type === 'object') {
    for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties, key)) throw new Error(`Invalid ${label}: unknown field`);
    for (const key of schema.required) validateShape(value[key], schema.properties[key], `${label}.${key}`);
  }
  return value;
}
