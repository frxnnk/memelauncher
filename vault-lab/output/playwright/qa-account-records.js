async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const context = await page.context().browser().newContext({ reducedMotion:'reduce', serviceWorkers:'block', acceptDownloads:true });
  const origin = 'http://127.0.0.1:4319', errors = [];
  const records = Array.from({ length:21 }, (_, index) => ({ id:`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    createdAt:'2026-09-14T19:00:00.000Z', modelRequested:'qwen/qwen3.5-9b', status:'complete', decision:'locked' }));
  let pauseNext = false, paused = false, release, historyReads = 0, detailReads = 0, inferenceCalls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    const rules = await (await context.request.get(origin + '/api/rules')).json();
    const catalog = await (await context.request.get(origin + '/api/models')).json();
    await context.route('**/api/**', async route => {
      const url = route.request().url(), path = url.slice(origin.length).split('?')[0];
      const token = route.request().headers().authorization;
      const respond = body => route.fulfill({ json:body });
      if (path.startsWith('/api/sandbox/')) throw new Error('Public history must not use the sandbox.');
      if (path === '/api/auth/config') return respond({ configured:true, appId:'qa', clientId:'qa', accessMode:'public-practice', sandboxEnabled:false });
      if (path === '/api/status') return respond({ configured:true, mode:'practice', accessMode:'public-practice', sandboxEnabled:false });
      if (path === '/api/rules') return respond(rules);
      if (path === '/api/models') return respond(catalog);
      if (path === '/api/account') return respond({ accountId:token === 'Bearer fixture-b' ? 'player_b' : 'player_a', authenticated:true, wallets:[], realFunds:false });
      if (path === '/api/receipts') {
        historyReads++; assert(['Bearer fixture-a', 'Bearer fixture-b'].includes(token), 'History must receive verified account credentials');
        if (token === 'Bearer fixture-b') return respond({ records:[], nextCursor:null });
        if (pauseNext) { pauseNext = false; paused = true; await gate; }
        const older = url.includes('?before=');
        try { return await respond({ records:older ? records.slice(20) : records.slice(0, 20), nextCursor:older ? null : records[19].id }); }
        catch { assert(paused, 'Only the deliberately cancelled history request may fail to fulfill'); return; }
      }
      if (path.startsWith('/api/receipts/')) {
        detailReads++; assert(token === 'Bearer fixture-a', 'Receipt must use account credentials');
        return respond({ record:{ ...records.find(record => path.endsWith(record.id)), promptVersion:'qa-history-only', evidence:'qa-fixture', usage:{ cost:0.001 },
          response:'PRIVATE_ACCOUNT_A_RECEIPT', inputMessages:[{ role:'user', content:'PRIVATE_ACCOUNT_A_PROMPT <img src=x onerror=alert(1)>' }] }, realFunds:false });
      }
      if (path === '/api/attempt') { inferenceCalls++; throw new Error('Reading history cannot submit a prompt.'); }
      throw new Error('Unexpected history QA endpoint: ' + path);
    });
    await context.route('**/vendor/privy.js', route => route.fulfill({ contentType:'text/javascript', body:
      `export async function createPrivyAccount(){let signed=null;return{sendCode:async()=>{},login:async(email)=>{signed=email.startsWith('other')?'b':'a';},headers:async()=>signed?{Authorization:'Bearer fixture-'+signed}:{},createWallet:async()=>{throw Error('No wallet action');},logout:async()=>{signed=null;}};}` }));
    const qa = await context.newPage(); qa.on('pageerror', e => errors.push(e.message));
    await qa.goto(origin); await qa.locator('#model-button:not([disabled])').waitFor();
    const closeInfo = () => qa.getByRole('button', { name:'Close details', exact:true }).click();
    const closeTreasury = () => qa.getByRole('button', { name:'Close treasury', exact:true }).click();
    async function login(email = 'qa@example.invalid') {
      await qa.locator('#treasury-button').click(); await qa.locator('#account-email').fill(email);
      await qa.locator('#account-send-code').click(); await qa.getByText('Code sent. Enter it below.', { exact:true }).waitFor();
      await qa.locator('#account-code').fill('123456'); await qa.locator('#account-login').click();
      await qa.getByText('Account verified. Deposits are not enabled yet.', { exact:true }).waitFor(); await closeTreasury();
    }
    await qa.locator('#record-button').click();
    await qa.getByText('Sign in through Treasury to view the receipts saved for your account.', { exact:true }).waitFor();
    assert(historyReads === 0, 'Signed-out history must not send requests'); await closeInfo();
    await login(); await qa.locator('#record-button').click();
    await qa.getByRole('button', { name:'Older receipts', exact:true }).waitFor();
    assert(await qa.locator('.record-row').count() === 20, 'Receipt list must be paginated');
    for (const [width, height] of [[1280,800], [390,844], [320,568]]) {
      await qa.setViewportSize({ width, height });
      assert(await qa.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'Receipt view must not overflow the page');
      assert(await qa.evaluate(() => document.querySelector('#info-dialog').scrollWidth <= document.querySelector('#info-dialog').clientWidth + 1), 'Receipt dialog must fit horizontally');
    }
    await qa.setViewportSize({ width:390,height:844 });
    await qa.screenshot({ path:'output/playwright/account-records-fixture-mobile.png', animations:'disabled' });
    await qa.getByRole('button', { name:'Older receipts', exact:true }).click();
    await qa.getByRole('button', { name:'Newest receipts', exact:true }).waitFor();
    assert(await qa.locator('.record-row').count() === 1, 'Older page should show remaining receipt');
    await qa.getByRole('button', { name:'View receipt', exact:true }).click();
    await qa.getByRole('button', { name:'Download receipt JSON', exact:true }).waitFor();
    assert((await qa.locator('#info-content').textContent()).includes('PRIVATE_ACCOUNT_A_RECEIPT'), 'Full server record must be available');
    assert(await qa.locator('#info-content img').count() === 0, 'Record text must not execute as HTML');
    const download = qa.waitForEvent('download'); await qa.getByRole('button', { name:'Download receipt JSON', exact:true }).click();
    await (await download).saveAs('output/playwright/qa-account-receipt.json');
    await qa.getByRole('button', { name:'Back to account receipts', exact:true }).click();
    await qa.getByRole('button', { name:'Newest receipts', exact:true }).waitFor(); await closeInfo();
    await qa.waitForFunction(() => document.querySelector('#info-content').textContent === '', null, { timeout:2000 });

    await qa.reload(); await qa.locator('#model-button:not([disabled])').waitFor(); await login();
    await qa.locator('#record-button').click(); await qa.getByRole('button', { name:'Older receipts', exact:true }).waitFor();
    assert(await qa.locator('#attempt-count').textContent() === '0', 'History retrieval must not create new attempts'); await closeInfo();
    pauseNext = true; await qa.locator('#record-button').click();
    for (let i=0; !paused && i<50; i++) await qa.waitForTimeout(20);
    assert(paused, 'Delayed history fixture must have started'); await closeInfo();
    await qa.locator('#treasury-button').click(); await qa.locator('#account-logout').click(); await closeTreasury();
    await login('other@example.invalid'); release();
    await qa.locator('#record-button').click(); await qa.getByText('No saved receipts on this page.', { exact:true }).waitFor();
    assert(!(await qa.locator('#info-content').textContent()).includes('PRIVATE_ACCOUNT_A'), 'Late response from previous account must never reappear');
    assert(await qa.locator('.record-row').count() === 0, 'Other account must not inherit history');
    assert(inferenceCalls === 0 && errors.length === 0, 'No inference or JavaScript errors expected: ' + errors.join('; '));
    return { passed:true, historyReads, detailReads, actualServerPosts:0, realInferenceCalls:0, realWalletActions:0,
      checked:['signed-out gate', 'pagination', 'download', 'reload', 'account isolation', 'late-response cancellation', 'private DOM cleanup', 'three viewports'], pageErrors:errors };
  } finally { release(); await context.close(); }
}
