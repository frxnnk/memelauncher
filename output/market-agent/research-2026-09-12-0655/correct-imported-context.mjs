import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const here = fileURLToPath(new URL('./', import.meta.url));
const workspace = path.resolve(here, '../../..');
const catalogPath = path.join(workspace, 'market-agent/concepts.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const oldCatalog = JSON.parse(await readFile(path.join(here, 'before-integration/concepts.json'), 'utf8'));
const originalPath = path.join(workspace, catalog.sightingsFile);
const original = JSON.parse(await readFile(originalPath, 'utf8'));
const importedIds = original.observations.filter(item => item.context === 'known_before_tracking'
  && item.observedAt === oldCatalog.generatedAt && oldCatalog.stories.some(story => story.id === item.storyKey))
  .map(item => item.storyKey);
if (!importedIds.length) throw new Error('Expected synthetic catalog imports are not present; do not repeat correction');
if (catalog.stories.some(story => importedIds.includes(story.id))) throw new Error('Correction cannot remove a current observation');

const directory = path.dirname(originalPath), lockPath = path.join(directory, '.writer.lock');
const lock = await open(lockPath, 'wx');
try {
  const recordedAt = new Date().toISOString();
  const corrected = { ...original, recordedAt,
    observations: original.observations.filter(item => !importedIds.includes(item.storyKey)),
    states: original.states.filter(item => !importedIds.includes(item.storyKey)),
    supersedesFile: catalog.sightingsFile,
    corrections: [{ kind: 'remove_nonobserved_catalog_imports', storyKeys: importedIds,
      reason: 'The prior integration incorrectly used catalog generation time as an observation time for old context. These are not source sightings. The earlier record remains preserved; old ideas remain in their archived catalogs with unknown firstSeenAt. New actual observations are unchanged.' }],
  };
  const file = path.join(directory, `${recordedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`);
  await writeFile(file, JSON.stringify(corrected, null, 2) + '\n', { flag: 'wx' });
  catalog.sightingsFile = path.relative(workspace, file).replaceAll(path.sep, '/');
  await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(JSON.stringify({ correctedFile: file, retainedStates: corrected.states.length, removedImports: importedIds }));
} finally {
  await lock.close();
  await unlink(lockPath);
}
