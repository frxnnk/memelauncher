async (page) => {
  const context=await page.context().browser().newContext({viewport:{width:1280,height:800},reducedMotion:'reduce',serviceWorkers:'block'});
  const qa=await context.newPage(),errors=[],posts=[];
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  qa.on('pageerror',error=>errors.push(error.message));
  await qa.route('**/*',route=>{if(route.request().method()==='POST'){posts.push(route.request().url());return route.abort();}return route.continue();});
  try {
    await qa.goto('http://127.0.0.1:4319/?ui=custodian');
    await qa.locator('#model-button:not([disabled])').waitFor();
    assert((await qa.locator('#connection-label').innerText()).includes('not configured'),'Actual preview must disclose absent API key');
    await qa.locator('#prompt').fill('A draft only. No inference.');
    assert(await qa.locator('#send-button').isDisabled(),'Actual preview should not send without a key');
    await qa.locator('#prompt').fill('');
    await qa.locator('#settings-button').click();
    assert((await qa.locator('#settings-content').innerText()).includes('deepinfra/bf16'),'Current profile should be shown in settings');
    await qa.locator('#close-settings').click();
    await qa.locator('#treasury-button').click();
    await qa.locator('#treasury-round option').first().waitFor({state:'attached'});
    assert((await qa.locator('#treasury-audit').innerText()).includes('0 TEST'),'Real local preview must have no QA balance');
    await qa.getByRole('button',{name:'Close treasury',exact:true}).click();
    await qa.screenshot({path:'output/playwright/vault-functional-desktop.png',animations:'disabled'});
    await qa.setViewportSize({width:390,height:844});
    await qa.screenshot({path:'output/playwright/vault-functional-mobile.png',animations:'disabled'});
    assert(await qa.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),'Actual mobile preview must fit');
    assert(!errors.length&&!posts.length,JSON.stringify({errors,posts}));
    return {passed:true,server:4319,configured:false,simulatedCustody:0,inferenceRequests:0,pageErrors:errors};
  } finally {await context.close();}
}
