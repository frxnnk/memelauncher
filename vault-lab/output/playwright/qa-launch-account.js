async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const browser = page.context().browser();
  const local = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  const errors = [], realPosts = [], origin = 'http://127.0.0.1:4319';
  let sandboxRequests = 0, inferenceRequests = 0, bundleRequests = 0, allowReply;
  const replyGate = new Promise(resolve => { allowReply = resolve; });
  try {
    const real = await local.newPage(); real.on('pageerror', e => errors.push(e.message));
    real.on('request', r => { if (r.method() === 'POST') realPosts.push(r.url()); });
    await real.goto(origin); await real.locator('#model-button:not([disabled])').waitFor();
    await real.locator('#treasury-button').click();
    await real.getByText('Privy integration prepared. App configuration is still required.', { exact: true }).waitFor();
    assert(await real.locator('#account-login-form').isHidden(), 'Unconfigured app must not offer a working login');
    assert(await real.locator('#send-button').isDisabled(), 'Unconfigured API must not infer');
    await real.getByRole('button', { name: 'Close treasury', exact: true }).click();
    for (const [width, height] of [[1280,720], [390,844], [320,568]]) {
      await real.setViewportSize({ width, height });
      assert(await real.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1), `Local viewport overflow at ${width}`);
    }
    await real.setViewportSize({ width:1280, height:800 });
    await real.screenshot({ path:'output/playwright/launch-local-desktop.png', animations:'disabled' });
    const rules = await (await local.request.get(origin + '/api/rules')).json();
    const catalog = await (await local.request.get(origin + '/api/models')).json();
    await context.route('**/api/**', async route => {
      const path = route.request().url().slice(origin.length).split('?')[0];
      const respond = body => route.fulfill({ json: body });
      if (path.startsWith('/api/sandbox/')) { sandboxRequests++; return route.fulfill({ status:404, json:{} }); }
      if (path === '/api/auth/config') return respond({ configured:true, appId:'qa', clientId:'qa', accessMode:'public-practice', sandboxEnabled:false });
      if (path === '/api/status') return respond({ configured:true, mode:'practice', accessMode:'public-practice', sandboxEnabled:false });
      if (path === '/api/rules') return respond(rules);
      if (path === '/api/models') return respond(catalog);
      if (path === '/api/account') {
        assert(route.request().headers().authorization === 'Bearer fixture', 'Account endpoint must receive SDK credentials');
        return respond({ accountId:'player_qa', authenticated:true, wallets:[], realFunds:false });
      }
      if (path === '/api/receipts') return respond({ records:[{ id:'qa-receipt', status:'complete', decision:'locked' }], nextCursor:null });
      if (path === '/api/attempt') {
        assert(route.request().headers().authorization === 'Bearer fixture', 'Inference must receive credentials');
        inferenceRequests++; await replyGate;
        return respond({ sessionId:'qa-session', decision:'locked', response:'QA fixture: that argument belongs in the recycling bin.',
          receipt:{ id:'qa-receipt', evidence:'qa-fixture', status:'complete', usage:{ cost:0.001 } } });
      }
      throw new Error('Unexpected QA endpoint: ' + path);
    });
    await context.route('**/vendor/privy.js', route => {
      bundleRequests++;
      return route.fulfill({ contentType:'text/javascript', body:`export async function createPrivyAccount(){let signed=false;return{sendCode:async()=>{},login:async()=>{signed=true;},headers:async()=>signed?{Authorization:'Bearer fixture'}:{},createWallet:async()=>{throw Error('Do not create wallets during QA');},logout:async()=>{signed=false;}};}` });
    });
    const qa = await context.newPage(); qa.on('pageerror', e => errors.push(e.message));
    await qa.goto(origin); await qa.locator('#model-button:not([disabled])').waitFor();
    await qa.locator('#prompt').fill('QA private argument');
    assert(await qa.locator('#send-button').isDisabled(), 'Public practice requires sign-in');
    assert(bundleRequests === 0, 'SDK must be lazy loaded');
    await qa.locator('#treasury-button').click();
    assert(await qa.locator('#treasury-amount').isHidden(), 'Public mode must hide simulated credits');
    await qa.locator('#account-email').fill('qa@example.invalid'); await qa.locator('#account-send-code').click();
    await qa.getByText('Code sent. Enter it below.', { exact:true }).waitFor();
    await qa.locator('#account-code').fill('123456'); await qa.locator('#account-login').click();
    await qa.getByText('Account verified. Deposits are not enabled yet.', { exact:true }).waitFor();
    await qa.setViewportSize({ width:390,height:844 });
    assert(await qa.evaluate(() => document.querySelector('#treasury-dialog').scrollWidth <= document.querySelector('#treasury-dialog').clientWidth + 1), 'Account dialog overflows horizontally');
    await qa.screenshot({ path:'output/playwright/launch-account-fixture-mobile.png', animations:'disabled' });
    await qa.getByRole('button', { name:'Close treasury', exact:true }).click();
    await qa.locator('#prompt').fill('QA private argument'); await qa.locator('#send-button').click();
    await qa.locator('#treasury-button').click();
    assert(await qa.locator('#account-logout').isDisabled(), 'Account must remain stable during inference');
    allowReply(); await qa.waitForFunction(() => document.querySelector('#attempt-count').textContent === '1');
    await qa.locator('#account-logout:not([disabled])').waitFor();
    await qa.getByRole('button', { name:'Close treasury', exact:true }).click();
    await qa.locator('#record-button').click();
    assert((await qa.locator('#info-content').textContent()).length > 0, 'Receipt dialog should have content before logout');
    await qa.getByRole('button', { name:'Close details', exact:true }).click();
    await qa.locator('#treasury-button').click(); await qa.locator('#account-logout').click();
    assert(await qa.locator('#attempt-count').textContent() === '0', 'Logout must clear prior receipts');
    assert(await qa.locator('#chat-thread').textContent() === '', 'Logout must clear private conversation');
    assert(await qa.locator('#info-content').textContent() === '', 'Logout must clear hidden receipt details');
    assert(await qa.locator('#send-button').isDisabled(), 'Logged-out account cannot infer');
    assert(sandboxRequests === 0 && realPosts.length === 0, 'QA must not mutate the actual app or query public sandbox');
    assert(inferenceRequests === 1 && bundleRequests === 1, 'Expected one fixture reply and lazy SDK import');
    assert(errors.length === 0, errors.join('; '));
    return { passed:true, realInferenceCalls:0, realWalletActions:0, actualServerPosts:realPosts.length,
      fixtureInferenceCalls:inferenceRequests, publicSandboxRequests:sandboxRequests, pageErrors:errors };
  } finally { allowReply(); await local.close(); await context.close(); }
}
