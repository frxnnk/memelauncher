// Keep the composer above a mobile keyboard. Pinch zoom retains the normal layout.
const root = document.documentElement;
let scheduled = 0;
function update() {
  scheduled = 0;
  const viewport = window.visualViewport;
  const zoomed = viewport && Math.abs(viewport.scale - 1) > .05;
  const height = zoomed ? window.innerHeight : Math.min(window.innerHeight, viewport?.height ?? window.innerHeight);
  root.style.setProperty('--app-height', `${Math.round(height)}px`);
  root.dataset.compact = String(height < 540);
  root.dataset.keyboard = String(!zoomed && window.innerHeight - height > 120);
}
function schedule() { if(!scheduled) scheduled=requestAnimationFrame(update); }
window.visualViewport?.addEventListener('resize',schedule);
window.addEventListener('resize',schedule);
update();
