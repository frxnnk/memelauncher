async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.reload();
  await page.locator('#model-button:not([disabled])').waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('16px Instrument')), 'Local typeface unavailable');
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1024, 768], [1440, 1000], [390, 320]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert(layout.width <= layout.viewport, `Horizontal overflow at ${width}x${height}`);
    await page.locator('#send-button').scrollIntoViewIfNeeded();
    const send = await page.locator('#send-button').boundingBox();
    assert(send.y >= 0 && send.y + send.height <= height, `Send is unreachable at ${width}x${height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator('#model-button:not([disabled])').waitFor();
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/vault-english-mobile.png' });
  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox', { name: 'Search models or providers' }).fill('zzzz-no-match');
  await page.getByText('No models match your search.').waitFor();
  await page.getByRole('searchbox', { name: 'Search models or providers' }).fill('gemini');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert((await page.locator('#model-label').innerText()).includes('Gemini'), 'Keyboard model selection failed');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  assert(await page.locator('#chat-main').evaluate(node => node.inert), 'Mobile panel must isolate covered chat');
  await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
  const copyResult = await page.locator('.copy-status:visible').first().innerText();
  assert(copyResult.includes('Copied') || copyResult.includes('selected'), 'No honest copy feedback');
  await page.locator('#theme-select').selectOption('dark');
  await page.locator('.panel-scroll').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/vault-english-mobile-settings.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert(!(await page.locator('#chat-main').evaluate(node => node.inert)), 'Desktop resize must restore chat');
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/vault-english-dark-settings.png' });
  await page.locator('#theme-select').selectOption('light');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/vault-english-models.png' });
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('#model-button:not([disabled])').waitFor();
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/vault-english-desktop.png' });
  assert(await page.locator('#send-button').isDisabled(), 'Real unconfigured API must keep send disabled');
  console.log('PASS: 6 viewport sizes, local font, model search/keyboard, copy feedback, theme, mobile inert and desktop recovery. Real API remains unconfigured.');
}
