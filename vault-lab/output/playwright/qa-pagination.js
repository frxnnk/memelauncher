async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const browser = page.context().browser();
  assert(browser, 'An isolated browser context is required.');
  const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const qa = await context.newPage();
  const origin = 'http://127.0.0.1:4319';
  const errors = [], unexpectedRequests = [];
  qa.setDefaultTimeout(10000);
  qa.on('pageerror', error => errors.push(error.message));
  const text = ('QA 👩‍💻🚀 family 👨‍👩‍👧‍👦, cafe\u0301, 日本語, Ελληνικά. Every character stays.  Two spaces.\n'
    + 'A second paragraph with punctuation — and a deliberately long word: ' + 'unbroken'.repeat(12) + '.\n\n').repeat(12)
    + 'Final exact characters: 🧑🏽‍🚀 END.  ';
  try {
    await qa.route('**/*', route => {
      const url = route.request().url();
      if (url === `${origin}/reply-pages.js` || url.startsWith(`${origin}/reply-pages.js?`)) return route.continue();
      if (url === `${origin}/__qa-pagination` || url.startsWith(`${origin}/__qa-pagination?`)) return route.fulfill({
        contentType: 'text/html', body: `<!doctype html><html lang="en"><head>
          <meta charset="utf-8"><link rel="icon" href="data:,">
          <style>body{margin:16px;font:16px Arial}#line{width:420px;height:96px;box-sizing:border-box;
          margin:0;padding:4px;border:1px solid;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;
          font:16px/24px Arial}[hidden]{display:none!important}</style></head><body>
          <p id="line" aria-live="polite">QA intro.</p><div id="reply-pagination">
          <button id="previous">Previous</button><span id="counter"></span><button id="next">Next</button></div>
          <script type="module">import {createReplyPages} from '/reply-pages.js';
          window.qaPages=createReplyPages({line:document.querySelector('#line'),previous:document.querySelector('#previous'),
          next:document.querySelector('#next'),counter:document.querySelector('#counter')});
          window.qaChanges=0;new MutationObserver(()=>window.qaChanges++).observe(document.querySelector('#line'),{childList:true});
          </script></body></html>`
      });
      unexpectedRequests.push(route.request().url());
      return route.abort();
    });
    await qa.goto(`${origin}/__qa-pagination`);
    await qa.waitForFunction(() => Boolean(window.qaPages));
    assert(await qa.locator('#reply-pagination').isHidden(), 'A short reply must hide pagination.');
    assert(await qa.locator('#counter').innerText() === '1 / 1', 'Initial counter must be 1 / 1.');
    assert(await qa.locator('#previous').isDisabled() && await qa.locator('#next').isDisabled(), 'Single-page boundaries must be disabled.');
    await qa.evaluate(value => window.qaPages.setText(value), text);
    assert(await qa.locator('#reply-pagination').isVisible(), 'A long reply must expose pagination.');
    const collect = () => qa.evaluate(() => {
      const line = document.querySelector('#line'), previous = document.querySelector('#previous'), next = document.querySelector('#next');
      let guard = 0;
      while (!previous.disabled && guard++ < 1000) previous.click();
      const pages = [];
      do {
        pages.push({ text: line.textContent, fits: line.scrollHeight <= line.clientHeight && line.scrollWidth <= line.clientWidth,
          label: document.querySelector('#counter').textContent, previousDisabled: previous.disabled });
        if (next.disabled) break;
        next.click();
      } while (pages.length < 1000);
      return { pages, nextDisabled: next.disabled };
    });
    const original = await collect();
    assert(original.pages.length > 1, 'The fixture must span multiple pages.');
    assert(original.pages.map(item => item.text).join('') === text, 'Initial pagination lost or duplicated text.');
    assert(original.pages.every(item => item.fits), 'A page overflows its fixed box.');
    assert(original.pages[0].previousDisabled && original.nextDisabled, 'Pagination boundaries are incorrect.');
    assert(original.pages.every((item, index) => item.label === `${index + 1} / ${original.pages.length}`), 'Page counters are incorrect.');
    const graphemesIntact = await qa.evaluate(({ text, chunks }) => {
      const boundaries = new Set([0]);
      for (const part of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)) boundaries.add(part.index + part.segment.length);
      let end = 0;
      return chunks.every(chunk => { end += chunk.length; return boundaries.has(end); });
    }, { text, chunks: original.pages.map(item => item.text) });
    assert(graphemesIntact, 'A Unicode grapheme was split.');
    await qa.locator('#previous').click();
    assert(await qa.locator('#line').textContent() === original.pages.at(-2).text, 'Previous must show the actual previous chunk.');
    await qa.evaluate(() => {
      const previous = document.querySelector('#previous');
      while (!previous.disabled) previous.click();
      document.querySelector('#next').click();
      document.querySelector('#next').click();
    });
    const offset = original.pages[0].text.length + original.pages[1].text.length;
    const beforeLabel = await qa.locator('#counter').textContent();
    await qa.evaluate(() => {
      window.qaChanges = 0;
      Object.assign(document.querySelector('#line').style, { width: '260px', height: '76px' });
    });
    await qa.waitForFunction(old => document.querySelector('#counter').textContent !== old, beforeLabel);
    const reflowLabel = await qa.locator('#counter').textContent();
    const reflowIndex = Number(reflowLabel.split('/')[0].trim()) - 1;
    await qa.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert(await qa.evaluate(() => window.qaChanges) <= 2, 'Resize caused repeated live-region writes or an observer loop.');
    const narrow = await collect();
    assert(narrow.pages.map(item => item.text).join('') === text, 'Reflow lost or duplicated text.');
    assert(narrow.pages.every(item => item.fits), 'A reflowed page overflows the short/mobile box.');
    const newStart = narrow.pages.slice(0, reflowIndex).reduce((total, item) => total + item.text.length, 0);
    assert(newStart <= offset && offset < newStart + narrow.pages[reflowIndex].text.length, 'Reflow lost the current reading offset.');
    await qa.evaluate(() => {
      document.querySelector('#line').style.fontSize = '20px';
      window.qaPages.refresh();
    });
    const largerFont = await collect();
    assert(largerFont.pages.map(item => item.text).join('') === text && largerFont.pages.every(item => item.fits), 'Explicit refresh must measure the current font without text loss.');
    await qa.evaluate(() => window.qaPages.setText('New exact reply.'));
    assert(await qa.locator('#line').textContent() === 'New exact reply.', 'setText must replace the prior source exactly.');
    assert(await qa.locator('#counter').innerText() === '1 / 1' && await qa.locator('#reply-pagination').isHidden(), 'A new short reply must reset to page one.');
    await qa.evaluate(() => window.qaPages.setText(''));
    assert(await qa.locator('#line').textContent() === '' && await qa.locator('#next').isDisabled(), 'Empty text must stay empty with no invented page.');
    assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
    assert(unexpectedRequests.length === 0, `Unexpected requests: ${unexpectedRequests.join(', ')}`);
    console.log(`PASS: isolated pagination QA; ${original.pages.length} original pages, ${narrow.pages.length} narrow pages; Unicode preserved, next/previous correct, no overflow, reading offset retained, fixed-font refresh and reset. No LLM or API calls.`);
  } finally {
    await qa.unrouteAll({ behavior: 'ignoreErrors' });
    await context.close();
  }
}
