async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const browser = page.context().browser();
  assert(browser, 'An isolated browser context is required for silent voice QA.');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const origin = 'http://127.0.0.1:4319';
  const errors = [], unexpectedRequests = [];
  const replies = ['QA fixture reply one. No real inference occurred.', 'QA fixture reply two. Still no real inference.'];
  const gates = replies.map(() => {
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    return { ready, release };
  });
  let attempts = 0;
  const qa = await context.newPage();
  qa.setDefaultTimeout(10000);
  qa.on('pageerror', error => errors.push(error.message));
  try {
    await context.route('**/*', route => {
      if (route.request().url().startsWith(`${origin}/`)) return route.continue();
      unexpectedRequests.push(route.request().url());
      return route.abort();
    });
    await qa.addInitScript(() => {
      const local = { name: 'QA local English', lang: 'en-US', localService: true, voiceURI: 'qa-local' };
      const remote = { name: 'QA forbidden remote', lang: 'en-US', localService: false, default: true };
      const mock = {
        calls: [], cancelCount: 0,
        fire(index, event, stale = false) {
          const call = this.calls[index];
          const handler = stale ? call.handlers[event] : call.utterance[`on${event}`];
          handler?.({ error: 'canceled' });
        }
      };
      const synth = new EventTarget();
      synth.getVoices = () => [remote, local];
      synth.speak = utterance => mock.calls.push({
        utterance, text: utterance.text, voice: utterance.voice,
        handlers: { start: utterance.onstart, end: utterance.onend, error: utterance.onerror }
      });
      synth.cancel = () => { mock.cancelCount += 1; };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true, value: class { constructor(text) { this.text = text; } }
      });
      window.__qaVoice = mock;
    });
    await qa.route('**/api/**', async route => {
      const path = route.request().url().slice(origin.length).split(/[?#]/)[0];
      if (path === '/api/status') return route.fulfill({ json: { configured: true, mode: 'practice', bountyEnabled: false } });
      if (path === '/api/models') return route.fulfill({ json: {
        models: [{ id: 'qa/fixture', name: 'QA fixture — no inference', company: 'QA', inputPricePerMillion: 0, outputPricePerMillion: 0 }],
        fetchedAt: '2026-09-14T00:00:00.000Z', source: 'QA fixture, no catalog request'
      } });
      if (path === '/api/rules') return route.fulfill({ json: {
        version: 'QA fixture only', systemPrompt: 'QA fixture. No model request is made.', tools: [],
        explanation: 'Controlled interface QA without inference.', limits: { maxTurns: 12, maxPromptCharacters: 2000 }
      } });
      if (path !== '/api/attempt') { unexpectedRequests.push(path); return route.abort(); }
      const index = attempts++;
      assert(index < gates.length, 'Unexpected attempt: a request could escape the planned QA sequence.');
      const input = route.request().postDataJSON();
      await gates[index].ready;
      const receipt = {
        id: `qa-voice-${index + 1}`, sessionId: 'qa-voice-session', status: 'complete', decision: 'locked',
        modelRequested: input.modelId, modelReturned: input.modelId, provider: 'QA fixture — no inference',
        promptVersion: 'QA fixture only', createdAt: '2026-09-14T00:00:00.000Z',
        inputMessages: [{ role: 'user', content: input.prompt }], usage: null
      };
      return route.fulfill({ json: {
        sessionId: receipt.sessionId, attemptId: receipt.id, modelId: input.modelId,
        decision: 'locked', response: replies[index], receipt
      } });
    });
    await qa.goto(`${origin}/`);
    await qa.locator('#model-button:not([disabled])').waitFor();
    await qa.locator('#voice-button:not([disabled])').waitFor();
    const stage = qa.locator('#guardian-stage');
    const voice = qa.locator('#voice-button');
    const callCount = () => qa.evaluate(() => window.__qaVoice.calls.length);
    const fire = (index, event, stale = false) => qa.evaluate(args => window.__qaVoice.fire(...args), [index, event, stale]);
    assert(await voice.getAttribute('aria-pressed') === 'false', 'Voice must start off.');
    assert(await callCount() === 0, 'Initial character text must not be spoken.');
    await voice.click();
    assert(await callCount() === 0, 'Enabling voice before a reply must not read the intro.');
    await voice.click();
    await qa.locator('#prompt').fill('QA player argument. This is not a real inference request.');
    assert(await stage.getAttribute('data-state') === 'watching', 'Typing must put the guardian in its watching state.');
    await Promise.all([qa.waitForRequest('**/api/attempt'), qa.locator('#send-button').click()]);
    assert(await stage.getAttribute('data-state') === 'thinking', 'Pending request must use the thinking state.');
    assert(await qa.locator('#guardian-source').innerText() === 'Request in progress', 'Waiting text must be labeled as status.');
    assert(await callCount() === 0, 'Waiting text must never enter speech synthesis.');
    gates[0].release();
    await qa.waitForFunction(text => document.querySelector('#guardian-line').textContent === text, replies[0]);
    assert(await qa.locator('#guardian-source').innerText() === 'Reply · QA fixture — no inference', 'Reply source is missing.');
    assert(await callCount() === 0, 'A reply must remain silent while voice is off.');
    await voice.click();
    assert(await qa.evaluate(() => window.__qaVoice.calls[0].text) === replies[0], 'Toggle must read the exact current reply.');
    await fire(0, 'start');
    assert(await stage.getAttribute('data-speaking') === 'true', 'Speech start must animate the mouth.');
    assert(await qa.locator('.voice-bars').evaluate(node => getComputedStyle(node).display) !== 'none', 'Speaking indicator must follow actual playback.');
    await voice.click();
    assert(await stage.getAttribute('data-speaking') === 'false', 'Mute must close the speaking mouth.');
    assert(await qa.evaluate(() => window.__qaVoice.cancelCount) === 1, 'Mute must cancel playback.');
    await voice.click();
    await fire(1, 'start');
    for (const event of ['start', 'end', 'error']) await fire(0, event, true);
    assert(await stage.getAttribute('data-speaking') === 'true', 'Stale canceled events must not affect a newer utterance.');
    assert(await voice.getAttribute('aria-pressed') === 'true', 'Stale errors must not disable voice.');
    await qa.locator('#prompt').fill('QA second player argument.');
    await Promise.all([qa.waitForRequest('**/api/attempt'), qa.locator('#send-button').click()]);
    assert(await qa.evaluate(() => window.__qaVoice.cancelCount) === 2, 'A new attempt must cancel the previous reply.');
    await fire(1, 'start', true);
    assert(await stage.getAttribute('data-speaking') === 'false', 'Canceled speech must not restart while thinking.');
    assert(await callCount() === 2, 'A pending attempt must not synthesize a status or previous reply.');
    gates[1].release();
    await qa.waitForFunction(text => document.querySelector('#guardian-line').textContent === text, replies[1]);
    await fire(2, 'start');
    assert(await stage.getAttribute('data-speaking') === 'true', 'Opted-in next reply must trigger speaking.');
    await qa.locator('#reset-button').click();
    await qa.locator('#confirm-reset').click();
    assert(await qa.evaluate(() => window.__qaVoice.cancelCount) === 3, 'Confirmed reset must cancel playback.');
    assert(await stage.getAttribute('data-state') === 'idle', 'Reset must restore the idle guardian.');
    await fire(2, 'start', true);
    assert(await stage.getAttribute('data-speaking') === 'false', 'Late speech events must stay inactive after reset.');
    assert(await qa.locator('#guardian-source').innerText() === 'Character intro', 'Reset must label the character intro.');
    const spoken = await qa.evaluate(() => window.__qaVoice.calls.map(call => ({ text: call.text, local: call.voice.localService })));
    assert(JSON.stringify(spoken.map(call => call.text)) === JSON.stringify([replies[0], replies[0], replies[1]]), 'Only exact recorded replies may be spoken.');
    assert(spoken.every(call => call.local === true), 'A remote voice must never be selected.');
    assert(attempts === 2 && unexpectedRequests.length === 0, `Unexpected requests: ${unexpectedRequests.join(', ')}`);
    assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
    console.log('PASS: isolated mascot/voice QA; default off, typing/thinking/real bubble, exact reply playback, mouth start, mute/stale events, new-attempt and reset cancellation. All API responses and speech were mocked; no inference or actual sound.');
  } finally {
    gates.forEach(gate => gate.release());
    await qa.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }
}
