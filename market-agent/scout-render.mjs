import { readFile } from 'node:fs/promises';

export async function renderScout(result) {
  const template = await readFile(new URL('./idea-map-template.html', import.meta.url), 'utf8');
  if (!result.map.stories.length) {
    const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    return `<article><h1>Radar: sin propuestas en esta pasada</h1><p>${escape(result.abstentionReason)}</p><p>${escape(result.coverageNote)}</p><p>${escape(result.map.generatedAt)}</p></article>`;
  }
  if (!template.includes('__MAP_DATA__')) throw new Error('Missing map template marker');
  const map = { ...result.map, stories: result.map.stories.map(story => ({ ...story,
    timingNote: story.timingNote.replace(result.coverageNote,
      'Cobertura del descubrimiento, antes de consultar mercado: ' + result.coverageNote)
      + ' La detección se registra al terminar esa etapa; no es el segundo exacto de apertura de cada fuente.' })) };
  return template.replace('__MAP_DATA__', () => JSON.stringify(map).replace(/</g, '\\u003c'));
}

export function scoutReport(result) {
  const line = value => String(value).replace(/[\r\n]/g, ' ');
  const rows = ['# Corrida autónoma del radar', '', `Fecha: ${result.map.generatedAt}`, '', line(result.summary), '',
    `Cobertura del descubrimiento, antes de consultar mercado: ${line(result.coverageNote)}`, '', 'Fuentes y juicios atribuidos al modelo; no prueban prioridad mundial, demanda ni rentabilidad.', ''];
  if (!result.map.stories.length) rows.push(`Sin propuestas: ${line(result.abstentionReason)}`, '');
  for (const story of result.map.stories) {
    rows.push(`## ${line(story.title)}`, '', line(story.summary), '', `Meme: ${line(story.meme)}`, '', `Brecha por comprobar: ${line(story.gap)}`, '');
    for (const idea of story.interpretations) rows.push(`- **${line(idea.title)} — ${idea.decision.status}**: ${line(idea.pitch)}`,
      `  Razón: ${line(idea.decisionReason)}`, `  Competencia: ${line(idea.competitionNote)}`, `  Prueba: ${line(idea.quickCheck)}`);
    rows.push('', ...story.evidence.map(e => `- Fuente: ${line(e.url)} (${line(e.label)})`), '');
  }
  rows.push('No se publicó, firmó ni lanzó ningún token. El informe y el mapa son resultados locales.');
  return rows.join('\n') + '\n';
}
