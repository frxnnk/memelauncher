async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers:'block' });
  const qa = await context.newPage(), errors=[],badResources=[];
  const assert = (ok,message) => { if (!ok) throw new Error(message); };
  qa.on('pageerror',error=>errors.push(error.message)); qa.on('response',response=>{if(response.status()>=400)badResources.push(response.url());});
  try {
    await qa.goto('http://127.0.0.1:4319/economics.html');
    await qa.locator('#prize-result').filter({hasText:'8,000'}).waitFor();
    await qa.locator('[name=tokenUsd]').fill('0');
    assert(await qa.locator('#operations-result').getAttribute('data-negative')==='true','Zero realization must show a shortfall');
    assert((await qa.locator('#coverage-result').innerText()).includes('external operating support'),'External support must be explicit');
    await qa.locator('[name=prizePercent]').fill('90');
    assert(await qa.locator('#projection').isHidden(),'Invalid split must hide stale projections');
    assert((await qa.locator('#input-error').innerText()).includes('exceed'),'Invalid split needs a readable error');
    await qa.locator('[name=prizePercent]').fill('70'); await qa.locator('[name=tokenUsd]').fill('0.01');
    await qa.locator('[name=sponsorTokens]').fill('500');
    assert(await qa.locator('#prize-result').innerText()==='8,500','Sponsor should grow only prize');
    const download = qa.waitForEvent('download'); await qa.locator('#export-economics').click();
    await (await download).saveAs('output/playwright/qa-economic-scenario.json');
    for(const [width,height] of [[1280,900],[768,1024],[390,844],[320,568]]) {
      await qa.setViewportSize({width,height});
      assert(await qa.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);
    }
    await qa.setViewportSize({width:1280,height:1000});
    await qa.screenshot({path:'output/playwright/economics-desktop.png',fullPage:true});
    assert(!errors.length&&!badResources.length,JSON.stringify({errors,badResources}));
    return {passed:true,realFunds:false,realMarketData:false,exported:true,sizes:4,pageErrors:errors,badResources};
  } finally { await context.close(); }
}
