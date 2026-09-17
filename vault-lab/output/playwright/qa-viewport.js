async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const browser = page.context().browser();
  assert(browser, 'QA requires an isolated browser context.');
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  const origin = 'http://127.0.0.1:4319', failures = [], summaries = [];
  const sizes = [[1440, 900], [1280, 720], [1024, 600], [768, 1024], [390, 844], [375, 667], [320, 568], [390, 320]];
  const longText = 'QA FIXTURE — NO REAL INFERENCE.\n' + ('Your argument has been recorded exactly.  Two spaces stay. '
    + 'Unicode stays too: 👩‍💻 cafe\u0301 日本語.\nSecond paragraph — the vault remains a fictional practice vault.\n\n').repeat(14) + 'QA END.  ';
  const model = { id: 'qa/viewport-custodian', name: 'QA: Viewport Custodian', company: 'QA', inputPricePerMillion: 0, outputPricePerMillion: 0 };
  const rules = { version: 'QA-viewport', systemPrompt: 'QA fixture. No inference or money.', tools: [],
    limits: { maxPromptCharacters: 2000, maxTurns: 12, maxContextCharacters: 12000, maxOutputTokens: 512 } };
  const settle = qa => qa.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function intercepted(pending, qa) {
    await Promise.race([pending, qa.waitForTimeout(10000).then(() => { throw new Error('QA request was not intercepted within 10 seconds'); })]);
  }
  async function inspect(qa, label, reply = false) {
    await settle(qa);
    const issues = await qa.evaluate(({ reply }) => {
      const issues = [], $ = selector => document.querySelector(selector);
      const rect = node => node.getBoundingClientRect();
      const visible = node => Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
      const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      for (const [name, node] of [['document', document.documentElement], ['body', document.body], ['conversation-area', $('.conversation-area')]]) {
        if (!node) { issues.push(`${name}: missing`); continue; }
        if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) issues.push(`${name}: overflow ${node.scrollWidth}×${node.scrollHeight} / ${node.clientWidth}×${node.clientHeight}`);
        const before = [node.scrollTop, node.scrollLeft]; node.scrollTop = 100; node.scrollLeft = 100;
        if (node.scrollTop > 1 || node.scrollLeft > 1 || before.some(value => value > 1)) issues.push(`${name}: scrolling is possible`);
        [node.scrollTop, node.scrollLeft] = before;
      }
      const required = ['#guardian-art', '#guardian-poke', '#guardian-bubble', '#guardian-line', '#attempt-form', '#prompt', '#send-button', '#voice-button', '#transcript-button', '#model-button', '#settings-button'];
      if (reply) required.push('#reply-previous', '#reply-next', '#reply-page-count', '#guardian-copy', '#guardian-receipt', '#guardian-share');
      const nodes = new Set(required.map(selector => {
        const node = $(selector); if (!visible(node)) issues.push(`${selector}: not visible`); return node;
      }).filter(Boolean));
      document.querySelectorAll('.app-header button, #chat-main button').forEach(node => { if (visible(node)) nodes.add(node); });
      for (const node of nodes) {
        if (!visible(node)) continue;
        const box = rect(node), name = node.id || node.textContent.trim();
        if (box.width <= 0 || box.height <= 0 || box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) issues.push(`${name}: outside viewport`);
        for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const clip = rect(parent), style = getComputedStyle(parent);
          if (/(hidden|clip|auto|scroll)/.test(style.overflowX) && (box.left < clip.left - 1 || box.right > clip.right + 1)) issues.push(`${name}: clipped horizontally by ${parent.id || parent.className}`);
          if (/(hidden|clip|auto|scroll)/.test(style.overflowY) && (box.top < clip.top - 1 || box.bottom > clip.bottom + 1)) issues.push(`${name}: clipped vertically by ${parent.id || parent.className}`);
        }
        if (node.tagName === 'BUTTON') {
          if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) issues.push(`${name}: button content clipped`);
          if (overlap(box, rect($('#prompt')))) issues.push(`${name}: overlaps editor`);
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          if (!node.disabled && hit && !node.contains(hit)) issues.push(`${name}: obscured at center`);
        }
      }
      if (rect($('#guardian-art')).height < 50) issues.push('Mascot is smaller than 50px');
      if (overlap(rect($('#guardian-bubble')), rect($('#attempt-form')))) issues.push('Reply bubble overlaps composer');
      const line = $('#guardian-line');
      if (line.scrollHeight > line.clientHeight + 1 || line.scrollWidth > line.clientWidth + 1) issues.push('Reply page overflows');
      return [...new Set(issues)];
    }, { reply });
    assert(!issues.length, `${label}: ${issues.join('; ')}`);
  }
  async function verifyPages(qa, expected, label) {
    const data = await qa.evaluate(() => {
      const previous = document.querySelector('#reply-previous'), next = document.querySelector('#reply-next');
      const line = document.querySelector('#guardian-line'), chunks = [], issues = [];
      let guard = 0; while (!previous.disabled && guard++ < 1000) previous.click();
      const firstDisabled = previous.disabled;
      do {
        chunks.push(line.textContent);
        if (line.scrollHeight > line.clientHeight + 1 || line.scrollWidth > line.clientWidth + 1) issues.push(`Page ${chunks.length} overflows`);
        if (document.querySelector('#reply-page-count').textContent !== `${chunks.length} / ${document.querySelector('#reply-page-count').textContent.split('/')[1].trim()}`) issues.push('Incorrect page index');
        if (next.disabled) break;
        next.click();
      } while (chunks.length < 1000);
      const lastDisabled = next.disabled, total = Number(document.querySelector('#reply-page-count').textContent.split('/')[1]);
      while (!previous.disabled && guard++ < 2000) previous.click();
      return { chunks, issues, firstDisabled, lastDisabled, total };
    });
    assert(data.chunks.length > 1 && data.chunks.length === data.total, `${label}: fixture must produce multiple correctly counted pages`);
    assert(data.chunks.join('') === expected, `${label}: pagination lost or duplicated recorded text`);
    assert(data.firstDisabled && data.lastDisabled && !data.issues.length, `${label}: ${data.issues.join('; ') || 'Invalid pagination boundaries'}`);
    await qa.locator('#reply-next').click();
    assert(await qa.locator('#guardian-line').textContent() === data.chunks[1], `${label}: Next shows incorrect text`);
    await qa.locator('#reply-previous').click();
    assert(await qa.locator('#guardian-line').textContent() === data.chunks[0], `${label}: Previous shows incorrect text`);
    return data.total;
  }
  try {
    for (const [width, height] of sizes) {
      const qa = await context.newPage(), label = `${width}x${height}`, errors = [], unexpected = [];
      let finishRequest, requestReady, successes = 0, requests = 0;
      qa.setDefaultTimeout(10000);
      qa.on('pageerror', error => errors.push(error.message));
      try {
        await qa.setViewportSize({ width, height });
        await qa.route('**/*', async route => {
          const request = route.request(), url = request.url(), path = url.startsWith(origin + '/') ? url.slice(origin.length).split('?')[0] : '';
          if (path === '/api/status') return route.fulfill({ json: { configured: true, mode: 'practice', bountyEnabled: false } });
          if (path === '/api/rules') return route.fulfill({ json: rules });
          if (path === '/api/models') return route.fulfill({ json: { models: [model], fetchedAt: '2026-09-14T12:00:00Z' } });
          if (path === '/api/attempt' && request.method() === 'POST') {
            requests += 1;
            const input = request.postDataJSON();
            await new Promise(resolve => { finishRequest = resolve; requestReady?.(); });
            if (input.prompt === 'QA pre-inference error') return route.fulfill({ status: 409, json: { error: { code: 'ATTEMPT_BUSY', message: 'QA: request rejected before inference.' } } });
            successes += 1;
            const decision = successes === 1 ? 'locked' : 'released', response = decision === 'locked' ? longText : `QA RELEASED.\n${longText}`;
            const receipt = { id: `QA-${label}-${successes}`, sessionId: `QA-${label}`, status: 'complete', decision,
              modelRequested: input.modelId, modelReturned: input.modelId, provider: 'QA fixture — no inference', promptVersion: rules.version,
              inputMessages: [{ role: 'user', content: input.prompt }], response };
            return route.fulfill({ json: { sessionId: receipt.sessionId, attemptId: receipt.id, decision, response, receipt } });
          }
          if (path && !path.startsWith('/api/') && request.method() === 'GET') return route.continue();
          unexpected.push(`${request.method()} ${url}`); return route.abort();
        });
        await qa.goto(origin);
        await qa.locator('#model-button:not([disabled])').waitFor();
        await qa.evaluate(() => document.fonts.ready);
        await inspect(qa, `${label} intro`);
        let pages = 0;
        for (const decision of ['locked', 'released']) {
          await qa.locator('#prompt').fill(`QA ${decision}: preserve the full recorded response.`);
          await inspect(qa, `${label} draft`);
          const pending = new Promise(resolve => { requestReady = resolve; });
          await qa.locator('#send-button').click();
          await intercepted(pending, qa);
          await qa.locator('#guardian-stage[data-state="thinking"]').waitFor();
          await inspect(qa, `${label} thinking`);
          assert(finishRequest, 'The intercepted request must be pending'); finishRequest(); finishRequest = null;
          await qa.locator(`#guardian-stage[data-state="${decision}"]`).waitFor();
          await inspect(qa, `${label} ${decision}`, true);
          pages = await verifyPages(qa, decision === 'locked' ? longText : `QA RELEASED.\n${longText}`, `${label} ${decision}`);
          assert(await qa.locator('#attempt-count').textContent() === String(successes), 'Receipt count must match successful mock requests, not page count');
          await qa.locator('#transcript-button').click();
          assert(await qa.locator('#chat-thread .assistant').count() === successes, 'Transcript duplicated or lost a response');
          assert(await qa.locator('#chat-thread .assistant p').last().textContent() === (decision === 'locked' ? longText : `QA RELEASED.\n${longText}`), 'Transcript does not preserve the complete response');
          await qa.getByRole('button', { name: 'Close transcript', exact: true }).click();
          await inspect(qa, `${label} transcript closed`, true);
        }
        assert(await qa.locator('#prompt').isDisabled() && await qa.locator('#send-button').isDisabled(), 'Released session must disable sending');
        await qa.screenshot({ animations: 'disabled', path: `output/playwright/QA-viewport-${label}-released.png` });
        await qa.locator('#continue-button').click();
        await qa.locator('#confirm-reset').click();
        assert(await qa.locator('#attempt-count').textContent() === '2' && await qa.locator('#transcript-count').textContent() === '0', 'Reset must preserve receipts and clear conversation');
        await qa.locator('#prompt').fill('QA pre-inference error');
        const rejected = new Promise(resolve => { requestReady = resolve; });
        await qa.locator('#send-button').click();
        await intercepted(rejected, qa);
        await qa.locator('#guardian-stage[data-state="thinking"]').waitFor();
        assert(finishRequest, 'The rejected request must be intercepted'); finishRequest(); finishRequest = null;
        await qa.locator('#guardian-stage[data-state="error"]').waitFor();
        await inspect(qa, `${label} pre-inference error`);
        assert(await qa.locator('#attempt-count').textContent() === '2' && await qa.locator('#chat-thread .message').count() === 0, 'Rejected request must not invent receipts or transcript messages');
        assert(await qa.locator('#prompt').inputValue() === 'QA pre-inference error' && !await qa.locator('#prompt').isDisabled(), 'Rejected request must preserve an editable draft');
        assert((await qa.locator('#guardian-source').textContent()).includes('not a model reply'), 'Error must not masquerade as a model response');
        assert(requests === 3 && successes === 2 && !errors.length && !unexpected.length, `Requests/errors: ${JSON.stringify({ requests, successes, errors, unexpected })}`);
        summaries.push(`${label}: PASS (${pages} release pages)`);
      } catch (error) {
        failures.push(`${label}: ${error.message}`);
        try { await qa.screenshot({ animations: 'disabled', path: `output/playwright/QA-viewport-${label}-failure.png` }); } catch {}
      } finally { finishRequest?.(); await qa.unrouteAll({ behavior: 'ignoreErrors' }); await qa.close(); }
    }
    console.log(JSON.stringify({ suite: 'QA viewport acceptance — API fixtures only, no inference', summaries, failures }, null, 2));
    assert(!failures.length, `QA viewport acceptance failed:\n${failures.join('\n')}`);
  } finally { await context.close(); }
}
