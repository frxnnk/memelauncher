async (page) => {
  const testPage = await page.context().newPage();
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  let finishRequest;
  const text = 'Controlled QA response. Not real inference.\n' + 'Long response text stays available in full. '.repeat(80);
  testPage.on('pageerror', error => errors.push(error.message));
  try {
    await testPage.setViewportSize({ width: 390, height: 844 });
    await testPage.route('**/api/status', route => route.fulfill({ json: { configured: true, mode: 'practice', bountyEnabled: false } }));
    await testPage.route('**/api/attempt', async route => {
      const input = route.request().postDataJSON();
      await new Promise(resolve => { finishRequest = resolve; });
      if (input.prompt === 'QA: failed request') {
        await route.fulfill({ status: 409, json: { error: { code: 'ATTEMPT_BUSY', message: 'QA: another request is pending.' } } });
      } else {
        await route.fulfill({ json: { sessionId: 'qa-mascot', decision: 'locked', response: text, receipt: { id: 'qa-mascot', status: 'complete', provider: 'QA fixture, no inference', modelRequested: input.modelId, modelReturned: input.modelId } } });
      }
    });
    await testPage.goto(page.url());
    await testPage.locator('#model-button:not([disabled])').waitFor();
    await testPage.locator('#prompt').fill('QA: long reply');
    await testPage.locator('#send-button').click();
    await testPage.locator('#guardian-stage[data-state="thinking"]').waitFor();
    await testPage.locator('#transcript-button').click();
    assert(await testPage.locator('#transcript-status').innerText() === 'The guardian is thinking…', 'Opened transcript must announce pending state');
    finishRequest();
    await testPage.locator('#guardian-stage[data-state="locked"]').waitFor();
    assert((await testPage.locator('#transcript-status').innerText()).includes('New reply'), 'Result must be announced inside the active modal');
    assert(await testPage.locator('#chat-thread .assistant p').innerText() === text, 'Transcript must preserve the entire response');
    assert(await testPage.locator('.close-dialog:visible').evaluate(node => node === document.activeElement), 'Reply must not steal modal focus');
    await testPage.locator('#chat-thread').evaluate(node => { node.scrollTop = 0; });
    await testPage.waitForFunction(() => !document.querySelector('#scroll-latest').hidden);
    await testPage.getByRole('button', { name: 'Close transcript' }).click();
    const paginatedText = await testPage.evaluate(() => {
      let full = '', safety = 0;
      while (!document.querySelector('#reply-previous').disabled) document.querySelector('#reply-previous').click();
      do {
        full += document.querySelector('#guardian-line').textContent;
        if (document.querySelector('#reply-next').disabled) break;
        document.querySelector('#reply-next').click();
      } while (safety++ < 300);
      return full;
    });
    assert(paginatedText === text, 'Reply pages must preserve full text without scrolling');
    const layout = await testPage.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, bubble: document.querySelector('#guardian-line').getBoundingClientRect().height }));
    assert(layout.width <= layout.viewport && layout.bubble <= 201, 'Long response must scroll inside its bubble without overflow');
    await testPage.locator('#transcript-button').click();
    assert(await testPage.locator('#chat-thread').evaluate(node => node.scrollTop) === 0, 'Reopening history must preserve reading position');
    await testPage.locator('#scroll-latest').click();
    await testPage.waitForFunction(() => { const node = document.querySelector('#chat-thread'); return node.scrollHeight - node.clientHeight - node.scrollTop < 80; });
    await testPage.getByRole('button', { name: 'Close transcript' }).click();
    await testPage.locator('#prompt').fill('QA: failed request');
    await testPage.locator('#send-button').click();
    await testPage.locator('#guardian-stage[data-state="thinking"]').waitFor();
    await testPage.locator('#transcript-button').click();
    finishRequest();
    await testPage.locator('#guardian-stage[data-state="error"]').waitFor();
    assert((await testPage.locator('#transcript-status').innerText()).includes('not sent to the model'), 'Error must remain accessible inside transcript');
    assert(await testPage.locator('#chat-thread .message').count() === 2, 'Rejected request must not create a false conversation turn');
    assert(await testPage.locator('#attempt-count').innerText() === '1', 'Rejected request must not create a receipt');
    await testPage.getByRole('button', { name: 'Close transcript' }).click();
    await testPage.emulateMedia({ reducedMotion: 'reduce' });
    const animations = await testPage.locator('.mascot-art').evaluate(node => getComputedStyle(node).animationName);
    assert(animations === 'none', 'Reduced motion must disable decorative animation');
    assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
    console.log('PASS: full long reply, scroll bounds and history position, live updates/errors inside transcript, no focus theft, reduced motion. All attempts intercepted; no inference.');
  } finally {
    finishRequest?.();
    await testPage.close();
  }
}
