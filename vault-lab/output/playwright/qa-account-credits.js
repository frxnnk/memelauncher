async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const origin = 'http://127.0.0.1:4319', errors = [];
  const context = await page.context().browser().newContext({ reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
  const address = value => '0x' + value.repeat(40), hash = value => '0x' + value.repeat(64);
  const asset = { chainId: '1337', decimals: 18, tokenAddress: address('1'), destination: address('3'), minimumConfirmations: 3 };
  const deposits = Array.from({ length: 21 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    state: index % 2 ? 'awaiting-receipt' : 'credit-recorded', credited: index % 2 === 0, accountingHold: false,
    createdAt: 1789421567809, expiresAt: 1789422467809, submittedAt: 1789421567843, attachedAt: null,
    owner: address('2'), asset, amountRequestedBaseUnits: '1000000000000000000', amountCreditedBaseUnits: index % 2 ? '0' : '1000000000000000000',
    transactionHash: hash('a'), logIndex: index % 2 ? null : '0x0', realFundsEnabled: false, evidence: 'qa-fixture' }));
  let mode = 'ready', pauseNext = false, paused = false, release, reads = 0, details = 0, writes = 0;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    const rules = await (await context.request.get(origin + '/api/rules')).json(), catalog = await (await context.request.get(origin + '/api/models')).json();
    const actualUnavailable = await context.request.get(origin + '/api/credits');
    assert(actualUnavailable.status() === 503 && (await actualUnavailable.json()).error.code === 'CREDITS_NOT_CONFIGURED', 'Actual server must keep unconfigured credits closed');
    await context.route('**/api/**', async route => {
      const request = route.request(), url = request.url(), path = url.slice(origin.length).split('?')[0], token = request.headers().authorization;
      if (request.method() !== 'GET') { writes++; throw new Error('Credit reading cannot post to the server.'); }
      const respond = body => route.fulfill({ json: body });
      if (path.startsWith('/api/sandbox/')) throw new Error('Private account credits must not read the shared sandbox.');
      if (path === '/api/auth/config') return respond({ configured: true, appId: 'qa', clientId: 'qa', accessMode: 'public-practice', sandboxEnabled: false, creditRecordsEnabled: true });
      if (path === '/api/status') return respond({ configured: true, mode: 'practice', accessMode: 'public-practice', sandboxEnabled: false });
      if (path === '/api/rules') return respond(rules);
      if (path === '/api/models') return respond(catalog);
      if (path === '/api/account') return respond({ accountId: token === 'Bearer fixture-b' ? 'player_b' : 'player_a', authenticated: true, wallets: [], realFunds: false });
      if (path === '/api/credits') {
        reads++; assert(['Bearer fixture-a', 'Bearer fixture-b'].includes(token), 'Summary must use account credentials');
        if (mode === 'unconfigured') return route.fulfill({ status: 503, json: { error: { code: 'CREDITS_NOT_CONFIGURED' } } });
        if (mode === 'error') return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR' } } });
        return respond({ unit: asset, available: token === 'Bearer fixture-b' ? '0' : mode === 'malformed' ? '-1' : '123456789012345678901',
          reserved: '7000000000000000000', prizePayable: '25000000000000000000', spendingPaused: mode === 'held', realFundsEnabled: false });
      }
      if (path === '/api/credits/deposits') {
        assert(['Bearer fixture-a', 'Bearer fixture-b'].includes(token), 'History must use account credentials');
        if (token === 'Bearer fixture-b') return respond({ deposits: [], nextCursor: null, realFundsEnabled: false });
        if (pauseNext) { pauseNext = false; paused = true; await gate; }
        const older = url.includes('?before=');
        try { return await respond({ deposits: older ? deposits.slice(20) : deposits.slice(0, 20), nextCursor: older ? null : deposits[19].id, realFundsEnabled: false }); }
        catch { assert(paused, 'Only the deliberately cancelled read may fail'); return; }
      }
      if (path.startsWith('/api/credits/deposits/')) {
        details++; assert(token === 'Bearer fixture-a', 'Detail must belong to the current account');
        return respond(deposits.find(deposit => path.endsWith(deposit.id)));
      }
      throw new Error('Unexpected credit QA endpoint: ' + path);
    });
    await context.route('**/vendor/privy.js', route => route.fulfill({ contentType: 'text/javascript', body:
      `export async function createPrivyAccount(){let signed=null;return{sendCode:async()=>{},login:async(email)=>{signed=email.startsWith('other')?'b':'a';},headers:async()=>signed?{Authorization:'Bearer fixture-'+signed}:{},createWallet:async()=>{throw Error('No wallet action');},logout:async()=>{signed=null;}};}` }));
    const qa = await context.newPage(); qa.on('pageerror', error => errors.push(error.message));
    await qa.goto(origin); await qa.locator('#model-button:not([disabled])').waitFor();
    const closeInfo = () => qa.getByRole('button', { name: 'Close details', exact: true }).click();
    const closeTreasury = () => qa.getByRole('button', { name: 'Close treasury', exact: true }).click();
    async function login(email = 'qa@example.invalid') {
      await qa.locator('#treasury-button').click(); await qa.locator('#account-email').fill(email);
      await qa.locator('#account-send-code').click(); await qa.getByText('Code sent. Enter it below.', { exact: true }).waitFor();
      await qa.locator('#account-code').fill('123456'); await qa.locator('#account-login').click();
      await qa.getByText('Account verified. Deposits are not enabled yet.', { exact: true }).waitFor();
    }
    const open = async () => { await qa.locator('#treasury-button').click(); await qa.locator('#account-credits').click(); };
    await open(); await qa.getByText('Sign in through Treasury to read your credit records.', { exact: true }).waitFor();
    assert(reads === 0, 'Signed-out credit view must not read private endpoints'); await closeInfo();
    await login(); await qa.locator('#account-credits').click(); await qa.getByRole('button', { name: 'Older deposits', exact: true }).waitFor();
    assert(await qa.locator('.record-row').count() === 20, 'Deposit list must use bounded pages');
    assert((await qa.locator('.account-credit-balances').textContent()).includes('123.456789012345678901'), 'Token precision must be preserved');
    for (const [width, height] of [[1280, 800], [390, 844], [320, 568]]) {
      await qa.setViewportSize({ width, height });
      assert(await qa.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'Credit view must not overflow the page');
      assert(await qa.evaluate(() => document.querySelector('#info-dialog').scrollWidth <= document.querySelector('#info-dialog').clientWidth + 1), 'Credit dialog must fit horizontally');
    }
    await qa.setViewportSize({ width: 390, height: 844 }); await qa.screenshot({ path: 'output/playwright/account-credits-fixture-mobile.png', animations: 'disabled' });
    await qa.getByRole('button', { name: 'Older deposits', exact: true }).click(); await qa.getByRole('button', { name: 'Newest deposits', exact: true }).waitFor();
    assert(await qa.locator('.record-row').count() === 1, 'Remaining deposit should appear on page two');
    await qa.getByRole('button', { name: 'View deposit', exact: true }).click(); await qa.getByRole('button', { name: 'Download deposit JSON', exact: true }).waitFor();
    assert((await qa.locator('#info-content').textContent()).includes(hash('a')), 'Stored transaction must be visible');
    const download = qa.waitForEvent('download'); await qa.getByRole('button', { name: 'Download deposit JSON', exact: true }).click();
    await (await download).saveAs('output/playwright/qa-credit-deposit.json');
    await qa.getByRole('button', { name: 'Back to your credits', exact: true }).click(); await qa.getByRole('button', { name: 'Newest deposits', exact: true }).waitFor();
    mode = 'error'; await qa.getByRole('button', { name: 'Refresh records', exact: true }).click();
    await qa.getByRole('button', { name: 'Retry reading records', exact: true }).waitFor();
    assert(await qa.locator('.account-credit-balances').count() === 0, 'Failed refresh must remove stale balances');
    mode = 'unconfigured'; await qa.getByRole('button', { name: 'Retry reading records', exact: true }).click();
    await qa.getByText('Account credits are not connected yet. Deposits and payouts are disabled.', { exact: true }).waitFor();
    mode = 'malformed'; await qa.getByRole('button', { name: 'Retry reading records', exact: true }).click();
    await qa.getByText('Could not load your credit records. Sign in again or retry. No funds were moved.', { exact: true }).waitFor();
    mode = 'held'; await qa.getByRole('button', { name: 'Retry reading records', exact: true }).click();
    await qa.getByText('Spending is on hold while deposit evidence is reconciled. Your recorded balance is preserved.', { exact: true }).waitFor();
    await closeInfo(); await qa.waitForFunction(() => document.querySelector('#info-content').textContent === '');
    mode = 'ready'; await qa.reload(); await qa.locator('#model-button:not([disabled])').waitFor(); await login();
    await qa.locator('#account-credits').click(); await qa.getByRole('button', { name: 'Older deposits', exact: true }).waitFor(); await closeInfo();
    pauseNext = true; await open(); for (let count = 0; !paused && count < 50; count++) await qa.waitForTimeout(20);
    assert(paused, 'Delayed deposit read must have started'); await closeInfo();
    await qa.locator('#treasury-button').click(); await qa.locator('#account-logout').click(); await closeTreasury();
    await login('other@example.invalid'); release(); await qa.locator('#account-credits').click();
    await qa.getByText('No deposit records on this page.', { exact: true }).waitFor();
    assert(!(await qa.locator('#info-content').textContent()).includes(address('2')), 'Previous wallet must not reappear');
    assert(await qa.locator('.record-row').count() === 0, 'Next account must not inherit deposits');
    assert(writes === 0 && errors.length === 0, 'No writes or browser errors: ' + errors.join('; '));
    return { passed: true, summaryReads: reads, detailReads: details, actualServerPosts: 0, walletActions: 0, inferenceCalls: 0, rpcChecks: 0,
      checked: ['actual unconfigured server', 'signed-out gate', 'exact amounts', 'pagination', 'download', 'reload', 'failures clear balances', 'holds', 'account isolation', 'late cancellation', 'private DOM cleanup', 'three viewports'], pageErrors: errors };
  } finally { release(); await context.close(); }
}
