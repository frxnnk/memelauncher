import { createHttpServer } from '../../server/http.mjs';
import { createEconomyService } from '../../server/economy/service.mjs';
import { createCreditGame } from '../../server/economy/model-game.mjs';
import { publicRules } from '../../server/profiles.mjs';
import { apiError } from '../../server/errors.mjs';
import { resolve } from 'node:path';

// Isolated QA fixtures. This process has no API transport, keys or disk ledger.
const economy = createEconomyService();
let calls = 0;
const service = {
  status: () => ({ configured: true, mode: 'practice', bountyEnabled: false, qaOnly: true, fixtureCalls: calls }),
  models: async () => ({ models: [{ id: 'qa/fixture', name: 'QA fixture', company: 'QA', inputPricePerMillion: 0, outputPricePerMillion: 0 }], fetchedAt: new Date().toISOString() }),
  rules: publicRules,
  attempt: async input => {
    calls++;
    if (input.prompt.includes('QA preflight')) throw apiError(409, 'ATTEMPT_BUSY', 'QA preflight refusal.');
    const decision = input.prompt.includes('QA release') ? 'released' : 'locked';
    const receipt = { id: `fixture-${calls}`, sessionId: 'fixture-session', status: 'complete', decision,
      modelRequested: input.modelId, modelReturned: input.modelId, provider: 'QA fixture; no inference',
      promptVersion: 'QA only', createdAt: new Date().toISOString(), usage: { cost: 0 },
      inputMessages: [{ role: 'user', content: input.prompt }] };
    return { sessionId: receipt.sessionId, attemptId: receipt.id, modelId: input.modelId, decision,
      response: `Controlled QA reply: ${decision}. No real model or funds.`, receipt };
  }
};
const creditGame = createCreditGame({ economy, vault: service });
const server = createHttpServer({ service, economy, creditGame, publicDir: resolve('public') });
server.listen(4321, '127.0.0.1', () => console.log('Credit QA fixture only · 4321 · no external transport'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { creditGame.close(); economy.close(); process.exit(0); }));
