async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const context = await page.context().browser().newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  const qa = await context.newPage(), errors = [];
  const origin = 'http://127.0.0.1:4321';
  qa.on('pageerror', error => errors.push(error.message));
  const state = async () => (await context.request.get(origin + '/api/sandbox/treasury')).json();
  const calls = async () => (await (await context.request.get(origin + '/api/status')).json()).fixtureCalls;
  const balance = (s, name) => s.balances.find(row => row.account === name)?.amount ?? '0';
  const treasury = async () => { await qa.locator('#treasury-button').click(); await qa.locator('#treasury-round option').first().waitFor({ state: 'attached' }); };
  const close = () => qa.getByRole('button', { name: 'Close treasury', exact: true }).click();
  const reset = async () => { await qa.locator('#reset-button').click(); if (await qa.locator('#reset-dialog').isVisible()) await qa.getByRole('button', { name: 'Start over', exact: true }).click(); };
  try {
    await qa.goto(origin); await qa.locator('#model-button:not([disabled])').waitFor();
    await treasury(); await qa.locator('#treasury-amount').fill('1000');
    await qa.getByRole('button', { name: 'Add test credits', exact: true }).click();
    await qa.waitForFunction(() => document.querySelector('#treasury-audit').textContent.includes('1,000 TEST'));
    await qa.getByRole('button', { name: 'Seed vault', exact: true }).click();
    await qa.waitForFunction(() => document.querySelector('#treasury-prize').textContent === '1,000');
    await qa.locator('#use-test-credits').check(); await close();
    await qa.locator('#prompt').fill('QA locked argument.');
    await qa.locator('#send-button').click();
    await qa.waitForFunction(() => document.querySelector('#attempt-count').textContent === '1');
    await qa.waitForFunction(() => document.querySelector('#practice-footer').textContent.includes('1,070 vault'));
    assert((await qa.locator('#connection-label').innerText()).includes('+70 TEST to vault'), 'Confirmed contribution should be visible beside the chat');
    assert(await calls() === 1, 'First credit reply should make one fixture inference');
    assert(balance(await state(), 'player:local-demo:available') === '900', 'Valid reply must consume 100 TEST');
    assert(await qa.evaluate(() => sessionStorage.getItem('vault-pending-test-attempt')) === null, 'Confirmed key must be cleared');
    const sizes = [[1440,900],[1280,720],[1024,600],[768,1024],[390,844],[375,667],[320,568],[390,320]];
    for (const [width,height] of sizes) {
      await qa.setViewportSize({ width,height }); await qa.waitForTimeout(80);
      const issues = await qa.evaluate(() => {
        const nodes = [document.documentElement, document.body, document.querySelector('.conversation-area')];
        const issues = nodes.filter(n => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1).map(n => n.tagName + ' overflows');
        const a = document.querySelector('#practice-footer').getBoundingClientRect(), b = document.querySelector('.chat-footer>div').getBoundingClientRect();
        if (Math.min(a.right,b.right) > Math.max(a.left,b.left)+1 && Math.min(a.bottom,b.bottom) > Math.max(a.top,b.top)+1) issues.push('Footer balances overlap controls');
        const turn = document.querySelector('#turn-label'); if (turn.scrollWidth > turn.clientWidth+1) issues.push('Price label clipped');
        return issues;
      });
      assert(!issues.length, `${width}x${height}: ${issues.join(', ')}`);
    }
    await qa.setViewportSize({ width:1280,height:800 });
    await qa.screenshot({ path:'output/playwright/credit-chat-desktop.png',animations:'disabled' });
    await qa.route('**/api/sandbox/model-attempt', async route => { await route.fetch(); await route.abort('connectionreset'); });
    await qa.locator('#prompt').fill('QA response lost after ledger settlement.'); await qa.locator('#send-button').click();
    await qa.locator('#guardian-stage[data-state="error"]').waitFor();
    const pending = await qa.evaluate(() => sessionStorage.getItem('vault-pending-test-attempt'));
    assert(pending, 'Lost response must retain the exact key');
    assert(balance(await state(), 'player:local-demo:available') === '800', 'Lost response was already charged once');
    await qa.unroute('**/api/sandbox/model-attempt');
    await treasury(); await qa.locator('#use-test-credits').uncheck(); await close(); await reset();
    await qa.locator('#prompt').fill('QA preflight ordinary practice request.'); await qa.locator('#send-button').click();
    await qa.locator('#guardian-stage[data-state="error"]').waitFor();
    assert(await qa.evaluate(() => sessionStorage.getItem('vault-pending-test-attempt')) === pending, 'Unrelated practice rejection must not clear the pending credit key');
    const before = await calls();
    await treasury(); await qa.locator('#reconcile-model-reply').click();
    await qa.getByRole('heading', { name:'Attempt receipt',exact:true }).waitFor();
    assert(await calls() === before, 'Reconciliation must not infer');
    assert(balance(await state(), 'player:local-demo:available') === '800', 'Reconciliation must not charge again');
    assert(await qa.evaluate(() => sessionStorage.getItem('vault-pending-test-attempt')) === null, 'Recovered key must clear');
    await qa.getByRole('button', { name:'Close details',exact:true }).click();
    await reset(); await treasury(); await qa.locator('#use-test-credits').check(); await close();
    await qa.locator('#prompt').fill('QA release fixture.'); await qa.locator('#send-button').click();
    await qa.locator('#guardian-stage[data-state="released"]').waitFor();
    const final = await state();
    assert(balance(final,'round:round-1:payable') === '1210', 'Winning reply should reserve 1,210 TEST including this attempt');
    assert(final.audit.balanced, 'Final ledger must balance');
    assert(errors.length === 0, 'Browser errors: '+errors.join('; '));
    return { passed:true, fixtureCalls:await calls(), realInferenceCalls:0, realFunds:false, viewportSizes:sizes.length, recovery:'No repeat inference or charge', winnerPayable:'1210 TEST', pageErrors:errors };
  } finally { await context.close(); }
}
