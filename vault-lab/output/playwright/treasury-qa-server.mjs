import { createHttpServer } from '../../server/http.mjs';
import { createEconomyService } from '../../server/economy/service.mjs';
import { resolve } from 'node:path';
import { RULES, GENERATION } from '../../server/rules.mjs';
const economy = createEconomyService();
const service = { status: () => ({ configured: false, mode: 'practice', bountyEnabled: false }),
  models: async () => ({ models: [{ id: 'qa/fixture', name: 'QA fixture', company: 'QA', inputPricePerMillion: 0, outputPricePerMillion: 0 }], source: 'QA fixture', fetchedAt: new Date().toISOString() }),
  rules: () => ({ ...RULES, generation: GENERATION }), attempt: async () => { throw new Error('QA never runs inference'); } };
const server = createHttpServer({ service, economy, publicDir: resolve('public') });
server.listen(4320, '127.0.0.1', () => console.log('QA only · in-memory test units · port 4320'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { economy.close(); process.exit(0); }));
