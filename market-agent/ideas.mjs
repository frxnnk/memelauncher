const STATUSES = new Set(['EXPLORE', 'REWORK', 'PASS']);
const MODES = new Set(['snapshot', 'retrospective']);
const BUILD_ESTIMATES = new Set(['hours', 'days', 'unknown']);
const COMPETITION = new Set(['represented', 'not_checked', 'partial']);
const ANGLES = new Set(['association', 'character', 'mechanic', 'cultural']);
const CLOCKS = ['publishedAt', 'firstSeenAt', 'firstMarketObservedAt', 'firstLaunchAt'];
const BRIEF_FIELDS = ['title', 'angle', 'pitch', 'whatItDoes', 'whyNow', 'distinctiveElement',
  'minimumBuild', 'competitionNote', 'quickCheck', 'discardIf', 'decisionReason'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;

function timestamp(value, label, nullable = true) {
  if (value === null || value === undefined) {
    if (nullable) return null;
    throw new Error(`${label} requires a full ISO timestamp`);
  }
  const match = typeof value === 'string' && value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match || !Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid full ISO timestamp or null`);
  const [, year, month, day, hour, minute, second] = match;
  const check = new Date(0);
  check.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  if (check.getUTCFullYear() !== Number(year) || check.getUTCMonth() !== Number(month) - 1
    || check.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error(`${label} must be a valid full ISO timestamp or null`);
  }
  return value;
}

function enumValue(value, choices, label, required = false) {
  if (!required && (value === undefined || value === null)) return;
  if (!choices.has(value)) throw new Error(`Invalid ${label}: expected ${[...choices].join(', ')}`);
}

function clocks(story, generatedAt) {
  const generated = timestamp(generatedAt, 'generatedAt', false);
  const values = Object.fromEntries(CLOCKS.map(key => [key, timestamp(story[key], key)]));
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && Date.parse(value) > Date.parse(generated)) throw new Error(`${key} cannot be later than generatedAt`);
  }
  return { ...values, generatedAt: generated };
}

function validateIdeaEnums(idea) {
  enumValue(idea.angle, ANGLES, 'angle');
  enumValue(idea.disposition, STATUSES, 'disposition');
  enumValue(idea.buildEstimate, BUILD_ESTIMATES, 'buildEstimate');
  enumValue(idea.competitionStatus, COMPETITION, 'competitionStatus');
}

/** Curated creative judgment, independent of token existence, liquidity or community size. */
export function evaluateIdea(idea, story, generatedAt) {
  if (!isObject(idea) || !isObject(story)) throw new Error('idea and story must be objects');
  enumValue(story.mode, MODES, 'story.mode', true);
  validateIdeaEnums(idea);
  const timing = clocks(story, generatedAt);
  const missing = BRIEF_FIELDS.filter(key => !hasText(idea[key]));
  for (const key of ['buildEstimate', 'competitionStatus', 'disposition']) {
    if (idea[key] === undefined || idea[key] === null) missing.push(key);
  }
  const hasExternalBasis = Array.isArray(idea.basisEvidenceIds) && idea.basisEvidenceIds.some(hasText);
  const hasLocalBasis = Array.isArray(idea.basisSourceFiles) && idea.basisSourceFiles.some(hasText);
  if (!hasExternalBasis && !hasLocalBasis) missing.push('basisEvidenceIds');
  const notes = [];
  const hours = (later, earlier) => (Date.parse(later) - Date.parse(earlier)) / 3_600_000;
  const invalidObservationOrder = timing.publishedAt !== null && timing.firstSeenAt !== null
    && Date.parse(timing.firstSeenAt) < Date.parse(timing.publishedAt);
  if (invalidObservationOrder) {
    missing.push('timing.firstSeenAt_before_publishedAt');
    notes.push('La observacion figura antes de la publicacion: corregir esa cronologia; no se calcula una ventaja temporal.');
  }
  timing.observationDelayHours = timing.publishedAt !== null && timing.firstSeenAt !== null && !invalidObservationOrder
    ? hours(timing.firstSeenAt, timing.publishedAt) : null;
  timing.leadToFirstLaunchHours = timing.firstSeenAt !== null && timing.firstLaunchAt !== null && !invalidObservationOrder
    ? hours(timing.firstLaunchAt, timing.firstSeenAt) : null;
  timing.knowledge = story.mode === 'retrospective' ? 'retrospective'
    : timing.firstSeenAt === null ? 'unknown' : 'observed';
  if (story.mode === 'retrospective') {
    notes.push('Lectura retrospectiva: los intervalos describen hechos pasados, no una ventana disponible hoy.');
  } else if (timing.firstSeenAt === null) {
    notes.push('Primera observacion desconocida; la fecha de publicacion no prueba cuando vimos la noticia ni prioridad de descubrimiento.');
  }
  if (timing.leadToFirstLaunchHours !== null && timing.leadToFirstLaunchHours <= 0) {
    notes.push('El lanzamiento registrado ya habia ocurrido al observar la noticia; el intervalo firmado indica llegada tardia, no una oportunidad negativa.');
  } else if (timing.leadToFirstLaunchHours !== null && story.mode === 'snapshot') {
    notes.push('Intervalo registrado entre observacion y lanzamiento; no equivale a tiempo restante desde la generacion de esta ficha.');
  }
  if (timing.firstLaunchAt === null) notes.push('Primer lanzamiento desconocido; no se afirma que aun no exista un token.');
  const status = idea.disposition === 'PASS' ? 'PASS' : missing.length ? 'REWORK' : idea.disposition;
  const reason = [hasText(idea.decisionReason) ? idea.decisionReason.trim() : 'Falta una razon editorial para decidir.',
    missing.length ? `Brief o cronologia por completar: ${missing.join(', ')}.` : '', ...notes].filter(Boolean).join(' ');
  return { status, reason, missing, timing, executionAuthorized: false };
}

/** Throws for malformed identity, enum or timestamp data; incomplete briefs remain reviewable. */
export function validateCatalog(catalog) {
  if (!isObject(catalog) || !Array.isArray(catalog.stories) || catalog.stories.length === 0) {
    throw new Error('catalog.stories must be a nonempty array');
  }
  if (catalog.version !== undefined && catalog.version !== 1) throw new Error('catalog.version must be 1');
  timestamp(catalog.generatedAt, 'generatedAt', false);
  const storyIds = new Set(), ideaIds = new Set();
  for (const story of catalog.stories) {
    if (!isObject(story) || !hasText(story.id)) throw new Error('Every story requires an id');
    if (storyIds.has(story.id)) throw new Error(`Duplicate story id: ${story.id}`);
    storyIds.add(story.id);
    enumValue(story.mode, MODES, 'story.mode', true);
    clocks(story, catalog.generatedAt);
    if (!Array.isArray(story.interpretations) || story.interpretations.length === 0) {
      throw new Error(`story ${story.id} requires nonempty interpretations`);
    }
    for (const idea of story.interpretations) {
      if (!isObject(idea) || !hasText(idea.id)) throw new Error('Every idea requires an id');
      if (ideaIds.has(idea.id)) throw new Error(`Duplicate idea id: ${idea.id}`);
      ideaIds.add(idea.id);
      validateIdeaEnums(idea);
      for (const key of ['relatedMarketNodeIds', 'basisEvidenceIds', 'basisSourceFiles']) {
        if (idea[key] !== undefined && (!Array.isArray(idea[key]) || idea[key].some(value => !hasText(value)))) {
          throw new Error(`${key} must be an array of nonempty strings`);
        }
      }
      if (Array.isArray(idea.basisSourceFiles) && idea.basisSourceFiles.length === 0) {
        throw new Error('basisSourceFiles must be nonempty when supplied');
      }
    }
  }
  if (catalog.evidence !== undefined) {
    if (!Array.isArray(catalog.evidence)) throw new Error('catalog.evidence must be an array');
    for (const source of catalog.evidence) {
      if (!isObject(source)) throw new Error('Evidence entries must be objects');
      for (const key of ['publishedAt', 'observedAt', 'firstSeenAt']) {
        const value = timestamp(source[key], `evidence.${key}`);
        if (value !== null && Date.parse(value) > Date.parse(catalog.generatedAt)) {
          throw new Error(`evidence.${key} cannot be later than generatedAt`);
        }
      }
    }
  }
  return catalog;
}

/** The caller chooses the real generation time and persists this result without overwriting history. */
export function makeDecisionRecord(catalog) {
  validateCatalog(catalog);
  return {
    version: 1, generatedAt: catalog.generatedAt, executionAuthorized: false,
    stories: catalog.stories.map(story => ({
      id: story.id, ...(hasText(story.title) ? { title: story.title } : {}), mode: story.mode,
      decisions: story.interpretations.map(idea => ({ ideaId: idea.id, title: idea.title ?? null,
        ...evaluateIdea(idea, story, catalog.generatedAt) })),
    })),
  };
}
