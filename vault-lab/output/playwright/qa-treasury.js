async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const qa = await context.newPage(); const errors = [];
  qa.on('pageerror', error => errors.push(error.message));
  await qa.addInitScript(() => {
    const callbacks = {};
    window.qaWalletCalls = [];
    window.ethereum = {
      request: async ({ method }) => { window.qaWalletCalls.push(method); if (method === 'eth_requestAccounts') return ['0x' + '1'.repeat(40)]; if (method === 'eth_chainId') return '0x1237'; throw new Error('QA forbids signing or transfers'); },
      on: (event, handler) => { callbacks[event] = handler; },
      removeListener: event => { delete callbacks[event]; }
    };
  });
  try {
    await qa.goto('http://127.0.0.1:4320/');
    await qa.locator('#treasury-button').click();
    await qa.locator('#treasury-round option').first().waitFor({ state: 'attached' });
    assert(await qa.evaluate(() => window.qaWalletCalls.length === 0), 'Wallet was contacted without a click');
    const act = async (label) => {
      const response = qa.waitForResponse(r => r.url().endsWith('/api/sandbox/action'));
      await qa.getByRole('button', { name: label, exact: true }).click();
      const result = await response; assert(result.ok(), `Action failed: ${label}`);
      await qa.waitForFunction(() => !document.querySelector('#treasury-export').disabled);
    };
    await act('Add test credits');
    await act('Seed vault');
    await act('Reserve attempt · 100');
    await act('Start processing');
    await act('Simulate: Vault stayed locked');
    assert((await qa.locator('#treasury-prize').innerText()) === '1,070', 'Prize did not receive 70 units');
    await qa.locator('#treasury-dialog').evaluate(node => { node.scrollTop = 0; });
    await qa.screenshot({ path: 'output/playwright/treasury-desktop.png' });
    await act('Reserve attempt · 100'); await act('Start processing'); await act('Mark outcome uncertain');
    await act('Reconcile: Technical error');
    assert((await qa.locator('#treasury-prize').innerText()) === '1,070', 'Error increased prize');
    await act('Reserve attempt · 100'); await act('Start processing'); await act('Simulate: Vault opened');
    await act('Simulate confirmed payout');
    assert((await qa.locator('#treasury-prize').innerText()) === '0', 'Paid vault not cleared');
    await qa.getByRole('button', { name: 'Connect Browser wallet', exact: true }).click();
    await qa.getByRole('button', { name: 'Disconnect locally', exact: true }).waitFor();
    assert((await qa.locator('#wallet-state').innerText()).includes('Ownership is not authenticated'), 'Wallet connected claim was overstated');
    assert(JSON.stringify(await qa.evaluate(() => window.qaWalletCalls)) === JSON.stringify(['eth_requestAccounts', 'eth_chainId']), 'Unexpected wallet RPC');
    await qa.getByRole('button', { name: 'Disconnect locally', exact: true }).click();
    const downloadPromise = qa.waitForEvent('download'); await qa.locator('#treasury-export').click();
    const download = await downloadPromise; assert(download.suggestedFilename() === 'vault-simulated-ledger.json', 'Wrong export');
    await qa.keyboard.press('Escape');
    assert(await qa.locator('#treasury-button').evaluate(node => node === document.activeElement), 'Focus did not return to treasury opener');
    await qa.reload(); await qa.locator('#treasury-button').click();
    await qa.locator('#treasury-round option').first().waitFor({ state: 'attached' });
    assert((await qa.locator('#treasury-audit').innerText()).includes('860 TEST'), 'Ledger did not survive page reload');
    for (const [width, height] of [[390,844], [320,568], [390,320]]) {
      await qa.setViewportSize({ width, height });
      const result = await qa.locator('#treasury-dialog').evaluate(node => ({ overflow: node.scrollWidth > node.clientWidth + 1, right: node.getBoundingClientRect().right, viewport: innerWidth }));
      assert(!result.overflow && result.right <= result.viewport, `Treasury overflow ${width}×${height}`);
    }
    await qa.setViewportSize({ width: 390, height: 844 });
    await qa.locator('#treasury-dialog').evaluate(node => { node.scrollTop = 0; });
    await qa.screenshot({ path: 'output/playwright/treasury-mobile.png' });
    assert(errors.length === 0, errors.join('\n'));
    return { passed: true, wallet: 'fixture only', realInference: false, realFunds: false };
  } finally { await context.close(); }
}
