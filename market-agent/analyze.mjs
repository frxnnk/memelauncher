// Research rules, not a probability model. All numeric thresholds are provisional.
export const POLICY = Object.freeze({ minLiquidityUsd: 25000, minHourlyVolumeUsd: 1000,
  minPoolAgeHours: 1, minFollowupHours: 24, maxBaseValueShare: 0.9 });
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const price = value => typeof value === 'string' && value.trim() !== '' ? number(Number(value)) : number(value);
const address = value => /^0x[\da-f]+$/i.test(value ?? '') ? value.toLowerCase() : value;
const key = (chain, value) => `${chain}:${address(value)}`;
const percent = (next, prev) => next !== null && prev > 0 ? 100 * (next / prev - 1) : null;

export function normalizePair(pair, observedAt) {
  if (!pair || typeof pair.chainId !== 'string' || typeof pair.pairAddress !== 'string' ||
      typeof pair.baseToken?.address !== 'string') return null;
  const usd = price(pair.priceUsd), liquidity = number(pair.liquidity?.usd);
  const base = number(pair.liquidity?.base);
  const baseValueShare = usd !== null && base !== null && liquidity > 0 ? usd * base / liquidity : null;
  const created = number(pair.pairCreatedAt), time = Date.parse(observedAt);
  const age = created !== null && created <= time ? (time - created) / 3600000 : null;
  const reasons = [];
  const hourlyVolume = number(pair.volume?.h1);
  if (liquidity === null) reasons.push('liquidity_missing');
  else if (liquidity < POLICY.minLiquidityUsd) reasons.push('thin_reported_liquidity');
  if (hourlyVolume === null) reasons.push('hourly_volume_missing');
  else if (hourlyVolume < POLICY.minHourlyVolumeUsd) reasons.push('low_hourly_activity');
  if (age === null) reasons.push('pool_age_unknown');
  else if (age < POLICY.minPoolAgeHours) reasons.push('pool_too_new');
  if (baseValueShare !== null && baseValueShare > POLICY.maxBaseValueShare) reasons.push('liquidity_mostly_base_valuation');
  if (usd === null || usd === 0) reasons.push('price_unavailable');
  const buys = number(pair.txns?.h1?.buys), sells = number(pair.txns?.h1?.sells);
  if (buys === null || sells === null) reasons.push('transaction_counts_missing');
  else if (buys === 0 || sells === 0) reasons.push('two_sided_activity_unobserved');
  return {
    id: key(pair.chainId, pair.pairAddress), tokenId: key(pair.chainId, pair.baseToken.address),
    chain: pair.chainId, tokenAddress: pair.baseToken.address, pairAddress: pair.pairAddress,
    name: pair.baseToken.name ?? '', symbol: pair.baseToken.symbol ?? '',
    quoteSymbol: pair.quoteToken?.symbol ?? '', quoteAddress: pair.quoteToken?.address ?? null,
    url: `https://dexscreener.com/${encodeURIComponent(pair.chainId)}/${encodeURIComponent(pair.pairAddress)}`,
    priceUsd: usd, marketCapUsd: number(pair.marketCap), reportedLiquidityUsd: liquidity,
    hourlyVolumeUsd: hourlyVolume, sixHourVolumeUsd: number(pair.volume?.h6),
    dailyVolumeUsd: number(pair.volume?.h24), buys1h: buys, sells1h: sells, poolAgeHours: age,
    baseValueShare, quoteValuationResidualUsd: baseValueShare !== null && baseValueShare <= 1
      ? liquidity - base * usd : null,
    activeBoosts: number(pair.boosts?.active),
    status: reasons.length ? 'WATCH' : 'RESEARCH', reasons,
  };
}

function uniquePairs(pairs, observedAt) {
  const found = new Map();
  for (const value of pairs ?? []) {
    const pair = normalizePair(value, observedAt);
    if (pair && !found.has(pair.id)) found.set(pair.id, pair);
  }
  return [...found.values()];
}

function groups(raw) {
  return [
    ...(raw.metas ?? []).map(m => ({ name: m.name ?? m.slug, source: m.slug, type: 'provider_category', pairs: m.pairs, collectionError: m.collectionError ?? null })),
    ...(raw.searches ?? []).map(s => ({ name: s.query, source: s.query, type: 'query_sample', pairs: s.pairs, collectionError: s.collectionError ?? null })),
  ];
}

function allPairs(raw) {
  return uniquePairs(groups(raw).flatMap(g => g.pairs ?? []), raw.observedAt);
}

export function analyzeMarket(raw, previousRaw = null) {
  if (!raw || !Number.isFinite(Date.parse(raw.observedAt))) throw new Error('Snapshot requires observedAt');
  const narratives = groups(raw).map(group => {
    const pairs = uniquePairs(group.pairs, raw.observedAt);
    const active = pairs.filter(p => p.status === 'RESEARCH');
    return { ...group, pairs: pairs.sort((a, b) => (b.hourlyVolumeUsd ?? -1) - (a.hourlyVolumeUsd ?? -1)),
      status: group.collectionError ? 'SOURCE_ERROR' : active.length ? 'RESEARCH' : pairs.length ? 'WATCH' : 'NO_DATA',
      observedTokens: new Set(pairs.map(p => p.tokenId)).size,
      activeTokens: new Set(active.map(p => p.tokenId)).size,
      interpretation: active.length ? 'Existing token activity warrants research; new-token demand is unproven.'
        : 'No sufficient market evidence in this bounded sample; absence is not an opportunity.',
    };
  });
  const current = new Map(allPairs(raw).map(pair => [pair.id, pair]));
  const elapsedHours = previousRaw ? (Date.parse(raw.observedAt) - Date.parse(previousRaw.observedAt)) / 3600000 : null;
  if (elapsedHours !== null && (!Number.isFinite(elapsedHours) || elapsedHours <= 0)) throw new Error('Previous snapshot must precede current snapshot');
  const followup = previousRaw ? allPairs(previousRaw).map(before => {
    const after = current.get(before.id);
    return { id: before.id, tokenId: before.tokenId, symbol: before.symbol,
      previousDecision: before.status, elapsedHours, status: after ? 'OBSERVED'
        : raw.errors?.length ? 'COVERAGE_INCOMPLETE' : 'NOT_IN_CURRENT_SAMPLE',
      coverageErrors: after ? [] : raw.errors ?? [],
      priceChangePct: after ? percent(after.priceUsd, before.priceUsd) : null,
      liquidityChangePct: after ? percent(after.reportedLiquidityUsd, before.reportedLiquidityUsd) : null,
      currentDecision: after?.status ?? null,
      sustainedDemandVerified: false,
    };
  }) : [];
  return { version: 1, observedAt: raw.observedAt, previousObservedAt: previousRaw?.observedAt ?? null,
    objective: 'cultural_market_opportunity_research', policy: POLICY, launchDecision: 'NO_LAUNCH',
    reason: 'Market observations alone do not establish demand for a proposed token.',
    coverage: raw.coverage ?? [], errors: raw.errors ?? [], narratives, followup,
    requiredEvidence: ['Fresh independent social adoption of the exact concept',
      'Distribution and creator activity plan', 'Exact competitor contracts and all relevant pools',
      'Holder funding links, bundles, permissions and executable depth',
      'Prospective outcomes including failures and missing observations', 'Platform, budget, fees and approved transaction'],
  };
}

const escape = value => String(value ?? '').replace(/[\r\n|`<>]/g, ' ').replace(/\[/g, '(').replace(/\]/g, ')');
const format = value => value === null || value === undefined ? 'n/d' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
export function renderReport(report) {
  const lines = ['# Agente de mercado — decisión de investigación', '', `Captura UTC: ${report.observedAt}`,
    '', '**Decisión: NO_LAUNCH.** La actividad de tokens existentes no demuestra demanda por uno nuevo.',
    'Objetivo: radar de oportunidades culturales y de mercado. Reglas heurísticas sin calibración predictiva.', '',
    '## Cobertura', '', ...report.coverage.map(item => `- ${escape(item)}`),
    '- RESEARCH prioriza investigación; WATCH conserva candidatos insuficientes; NO_DATA no prueba ausencia.',
    '- Volumen reportado no es flujo neto; compras no son compradores únicos; boosts no prueban demanda orgánica.',
    '- Liquidez reportada y residual quote son valoraciones contables, no profundidad ejecutable.',
    '- El orden de categorías procede del proveedor; no es un ranking de probabilidad de éxito.', '',
    '## Comparación', '', '| Narrativa / consulta | Tokens observados | Con filtros básicos | Estado |', '|---|---:|---:|---|',
    ...report.narratives.map(n => `| ${escape(n.name)} | ${n.observedTokens} | ${n.activeTokens} | ${n.status} |`), '',
  ];
  for (const narrative of report.narratives) {
    lines.push(`## ${escape(narrative.name)}`, '', 'Hasta 5 pools por actividad horaria. La evidencia JSON conserva todos los resultados.', '',
      '| Token / red | Pool exacto | Liq. USD | Vol. 1h USD | Edad h | Estado / motivos |', '|---|---|---:|---:|---:|---|');
    for (const p of narrative.pairs.slice(0, 5)) {
      lines.push(`| ${escape(p.symbol)} / ${escape(p.chain)} | [${escape(p.pairAddress)}](${p.url}) | ${format(p.reportedLiquidityUsd)} | ${format(p.hourlyVolumeUsd)} | ${format(p.poolAgeHours)} | ${p.status}: ${p.reasons.join(', ') || 'filtros básicos presentes'} |`);
    }
    lines.push('');
  }
  lines.push('## Seguimiento prospectivo', '', report.previousObservedAt
    ? `Comparación con ${report.previousObservedAt}; ${report.followup.length} pools previos, incluidos WATCH y ausentes.`
    : 'Primera captura: todavía no hay resultados posteriores ni aciertos medidos.',
    'Ausente de la muestra actual significa no observado, no precio cero ni fracaso confirmado. Las ventanas móviles pueden superponerse.',
    'Ni dos capturas ni 24 horas por sí solas verifican demanda sostenida, organicidad o rentabilidad.', '',
    '## Evidencia pendiente antes de proponer un lanzamiento', '', ...report.requiredEvidence.map(e => `- ${e}`));
  if (report.errors.length) lines.push('', '## Errores de cobertura', '', ...report.errors.map(e => `- ${escape(e.endpoint)}: ${escape(e.message)}`));
  return lines.join('\n') + '\n';
}
