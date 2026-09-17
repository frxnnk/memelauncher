// The caller owns the full reply for voice/copy/export. This module only changes its visible page.
export function createReplyPages({ line, previous, next, counter }) {
  const doc = line.ownerDocument;
  const pagination = doc.getElementById('reply-pagination');
  const textStyles = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch',
    'fontVariant', 'fontKerning', 'fontFeatureSettings', 'fontVariationSettings', 'lineHeight',
    'letterSpacing', 'wordSpacing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'hyphens',
    'tabSize', 'textIndent', 'textTransform', 'textAlign', 'direction'];
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
  let source = '', pages = [{ start: 0, end: 0 }], current = 0, layoutKey = '', frame = 0;

  function render() {
    const page = pages[current];
    const text = source.slice(page.start, page.end);
    // Measuring happens in an aria-hidden node; unchanged pages never rewrite the live region.
    if (line.textContent !== text) line.textContent = text;
    const label = `${current + 1} / ${pages.length}`;
    if (counter.textContent !== label) counter.textContent = label;
    previous.disabled = current === 0;
    next.disabled = current === pages.length - 1;
    if (pagination) pagination.hidden = pages.length === 1;
    line.scrollTop = 0;
    line.scrollLeft = 0;
  }

  function refresh() {
    const style = getComputedStyle(line);
    const width = line.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    const height = line.clientHeight - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0);
    const key = [width, height, ...textStyles.map(property => style[property])].join('|');
    if (key === layoutKey) return;
    layoutKey = key;
    const offset = pages[current]?.start || 0;
    // A hidden line is remeasured when ResizeObserver reports usable dimensions.
    if (width <= 0 || height <= 0 || !source) {
      pages = [{ start: 0, end: source.length }];
      current = 0;
      render();
      return;
    }
    const measure = doc.createElement('div');
    measure.setAttribute('aria-hidden', 'true');
    measure.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;box-sizing:content-box;margin:0;padding:0;border:0;height:auto;min-height:0;max-height:none;overflow:visible;';
    for (const property of textStyles) measure.style[property] = style[property];
    measure.style.width = `${width}px`;
    doc.body.append(measure);
    const boundaries = [0];
    if (segmenter) {
      for (const part of segmenter.segment(source)) boundaries.push(part.index + part.segment.length);
    } else {
      for (const character of source) boundaries.push(boundaries.at(-1) + character.length);
    }
    const result = [];
    try {
      let start = 0;
      while (start < boundaries.length - 1) {
        let low = start + 1, high = boundaries.length - 1, end = start;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          measure.textContent = source.slice(boundaries[start], boundaries[middle]);
          if (measure.getBoundingClientRect().height <= height + .25 && measure.scrollWidth <= width + 1) {
            end = middle;
            low = middle + 1;
          } else high = middle - 1;
        }
        // Fixed line dimensions must provide room for at least one grapheme. Always advance.
        end = Math.max(start + 1, end);
        if (end < boundaries.length - 1) {
          for (let split = end; split > start; split -= 1) {
            if (/\s$/u.test(source.slice(boundaries[split - 1], boundaries[split]))) { end = split; break; }
          }
        }
        result.push({ start: boundaries[start], end: boundaries[end] });
        start = end;
      }
    } finally { measure.remove(); }
    pages = result;
    current = pages.findIndex(page => page.start <= offset && offset < page.end);
    if (current < 0) current = Math.max(0, pages.length - 1);
    render();
  }

  function schedule(force = false) {
    if (force) layoutKey = '';
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; refresh(); });
  }

  function setText(text) {
    source = typeof text === 'string' ? text : String(text ?? '');
    pages = [{ start: 0, end: source.length }];
    current = 0;
    layoutKey = '';
    refresh();
  }

  previous.type = next.type = 'button';
  previous.addEventListener('click', () => {
    if (current > 0) { current -= 1; render(); }
  });
  next.addEventListener('click', () => {
    if (current < pages.length - 1) { current += 1; render(); }
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => schedule()).observe(line);
  else globalThis.addEventListener('resize', () => schedule());
  doc.fonts?.ready.then(() => schedule(true));
  doc.fonts?.addEventListener('loadingdone', () => schedule(true));
  setText(line.textContent);
  return { setText, refresh };
}
