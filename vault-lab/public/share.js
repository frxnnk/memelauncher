const COLORS = { ivory: '#f7f7f5', ink: '#242424', accent: '#555555', muted: '#72726e', paper: '#eaeae7' };
let dialog, preview, status, download, blobUrl, filename, revision = 0;

function clearImage() {
  if (blobUrl) { const previous = blobUrl; setTimeout(() => URL.revokeObjectURL(previous), 1500); }
  blobUrl = null;
  download.disabled = true;
}

function createDialog() {
  dialog = document.createElement('dialog');
  dialog.className = 'share-dialog';
  dialog.setAttribute('aria-labelledby', 'share-title');
  const heading = document.createElement('div');
  heading.className = 'dialog-heading';
  const title = document.createElement('h2');
  title.id = 'share-title';
  title.textContent = 'Your attempt, in a picture';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-button';
  close.setAttribute('aria-label', 'Close image');
  close.textContent = '×';
  close.addEventListener('click', () => dialog.close());
  heading.append(title, close);
  preview = document.createElement('div');
  preview.className = 'share-preview';
  const note = document.createElement('p');
  note.className = 'share-note';
  note.textContent = 'This card uses your message and the recorded response. Cuts are marked […]. For the full JSON, open “View receipt” on the message. Downloading does not publish anything.';
  status = document.createElement('p');
  status.className = 'share-status';
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'share-actions';
  download = document.createElement('button');
  download.type = 'button';
  download.className = 'download-button';
  download.textContent = 'Download PNG';
  download.disabled = true;
  download.addEventListener('click', () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    try {
      link.href = blobUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      status.textContent = 'Download requested. If the file does not appear, check your browser downloads.';
    } catch { status.textContent = 'Your browser could not start the download. You can try again.'; }
    finally { link.remove(); }
  });
  actions.append(download);
  dialog.append(heading, preview, note, status, actions);
  dialog.addEventListener('close', () => { revision += 1; clearImage(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  document.body.append(dialog);
}

function rounded(ctx, x, y, width, height, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function fit(ctx, text, width) {
  const chars = Array.from(String(text));
  if (ctx.measureText(chars.join('')).width <= width) return chars.join('');
  while (chars.length && ctx.measureText(`${chars.join('')} […]`).width > width) chars.pop();
  return `${chars.join('')} […]`;
}

function excerpt(ctx, text, x, y, width, maxLines, lineHeight) {
  const characters = Array.from(String(text).trim());
  const lines = [];
  let line = '', position = 0;
  while (position < characters.length && lines.length < maxLines) {
    const character = characters[position++];
    if (character === '\n') { lines.push(line); line = ''; continue; }
    if (ctx.measureText(line + character).width > width) { lines.push(line); line = character; }
    else line += character;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const clipped = position < characters.length || (lines.length === maxLines && line.length > 0);
  if (clipped) lines[maxLines - 1] = fit(ctx, `${lines[maxLines - 1]} […]`, width);
  lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return clipped;
}

function loadMascot() {
  return new Promise(resolve => {
    const mascot = new Image();
    const finish = value => {
      clearTimeout(timer);
      mascot.onload = mascot.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 3000);
    mascot.onload = () => finish(mascot.naturalWidth && mascot.naturalHeight ? mascot : null);
    mascot.onerror = () => finish(null);
    mascot.src = '/assets/vault-mark.svg';
  });
}

function drawCard(prompt, result, modelName, mascot) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Recorded attempt card with excerpts of the message, response, and receipt details.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const font = 'Instrument, "Segoe UI", sans-serif';
  const released = result.decision === 'released';
  ctx.fillStyle = COLORS.ivory; ctx.fillRect(0, 0, 1200, 900);
  rounded(ctx, 64, 47, 42, 5, 2, COLORS.accent);
  ctx.fillStyle = COLORS.muted; ctx.font = `600 22px ${font}`; ctx.fillText('VAULT / HUMAN VS. GUARDIAN', 64, 95);
  ctx.fillStyle = COLORS.ink; ctx.font = `600 65px ${font}`;
  ctx.fillText(released ? 'The vault opened.' : 'Vault still locked.', 60, 178);
  ctx.font = `400 23px ${font}`;
  const model = result.receipt?.modelReturned || result.modelId || modelName || 'Not reported';
  const label = result.receipt?.modelReturned ? 'Model reported by API' : 'Requested model';
  ctx.fillText(fit(ctx, `${label}: ${model}`, 865), 64, 228);
  if (mascot) {
    const scale = Math.min(218 / mascot.naturalWidth, 218 / mascot.naturalHeight);
    const width = mascot.naturalWidth * scale, height = mascot.naturalHeight * scale;
    try { ctx.drawImage(mascot, 936 + (218 - width) / 2, 28 + (218 - height) / 2, width, height); }
    catch { /* The recorded text card remains usable if the portrait cannot be drawn. */ }
  }
  rounded(ctx, 64, 268, 1072, 163, 18, COLORS.paper);
  ctx.fillStyle = COLORS.muted; ctx.font = `600 19px ${font}`; ctx.fillText('YOUR ATTEMPT', 90, 305);
  ctx.fillStyle = COLORS.ink; ctx.font = `400 28px ${font}`;
  const promptClipped = excerpt(ctx, prompt, 90, 351, 1018, 2, 37);
  rounded(ctx, 64, 454, 1072, 278, 18, COLORS.ink);
  ctx.fillStyle = COLORS.accent; ctx.font = `600 19px ${font}`; ctx.fillText('THE GUARDIAN', 90, 495);
  ctx.fillStyle = COLORS.ivory; ctx.font = `400 30px ${font}`;
  const responseClipped = excerpt(ctx, result.response, 90, 545, 1018, 4, 40);
  ctx.fillStyle = COLORS.muted; ctx.font = `400 18px ${font}`;
  ctx.fillText(promptClipped || responseClipped ? 'Recorded attempt excerpts · […] marks omitted text' : 'Message and response from the recorded attempt', 64, 775);
  ctx.fillStyle = COLORS.ink; ctx.font = `600 19px ${font}`;
  ctx.fillText('PRACTICE · NO REAL PRIZE · SERVER RECORD', 64, 822);
  ctx.fillStyle = COLORS.muted; ctx.font = `400 18px ${font}`;
  ctx.fillText(fit(ctx, `Receipt: ${result.receipt?.id || result.attemptId || 'ID not reported'}`, 1072), 64, 856);
  return canvas;
}

export async function showShare({ prompt, result, modelName }) {
  if (!dialog) createDialog();
  const current = ++revision;
  clearImage();
  preview.replaceChildren();
  status.textContent = 'Preparing your image…';
  if (!dialog.open) dialog.showModal();
  try {
    if (!['locked', 'released'].includes(result?.decision) || typeof prompt !== 'string' || typeof result.response !== 'string') throw new Error('Incomplete attempt');
    const [mascot] = await Promise.all([loadMascot(), document.fonts?.ready]);
    if (current !== revision || !dialog.open) return;
    const canvas = drawCard(prompt, result, modelName, mascot);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG unavailable');
    if (current !== revision || !dialog.open) return;
    blobUrl = URL.createObjectURL(blob);
    filename = `vault-${String(result.receipt?.id || result.attemptId || 'attempt').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    preview.append(canvas);
    download.disabled = false;
    status.textContent = `1200 × 900 PNG. It only downloads when you request it.${mascot ? '' : ' Portrait unavailable; the recorded text is included.'}`;
  } catch {
    if (current === revision) status.textContent = 'The PNG could not be generated. The attempt is still available in the chat and its receipt.';
  }
}
