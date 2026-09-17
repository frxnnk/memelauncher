import { BotEngine } from './bloub/engine.ts';
import { EXPRESSION_BY_ID } from './bloub/expressions.ts';

const ns = 'http://www.w3.org/2000/svg';
const moods = {
  idle:['idle','neutre'], watching:['idle','attentif'], thinking:['thinking','neutre'],
  locked:['idle','mefiant'], released:['wide','surpris'], error:['idle','confus'], sleep:['sleep','somnolent']
};

// Presentation only: this renderer cannot make requests, choose a winner or change a receipt.
export function createVaultFace(svg) {
  let engine = new BotEngine(100), state = 'idle', speaking = false, poked = false;
  let frame = 0, last = 0, sleepTimer, clock = 0, pointer = null, pointerDirty = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const body = svg.querySelector('[data-face-body]');
  const clip = svg.querySelector('[data-face-clip]');
  const eyes = [...svg.querySelectorAll('[data-face-eye]')];
  const dots = svg.querySelector('[data-face-dots]');

  function render(time) {
    if (pointerDirty) {
      pointerDirty = false;
      const box = svg.getBoundingClientRect();
      if (pointer && box.width > 0 && box.height > 0) {
        gaze((pointer.x - box.left - box.width / 2) / Math.max(1, window.innerWidth / 2),
          (pointer.y - box.top - box.height / 2) / Math.max(1, window.innerHeight / 2));
      }
    }
    const pose = engine.sample(time);
    body.setAttribute('d', pose.bodyPath);
    clip.setAttribute('d', pose.bodyPath);
    body.setAttribute('opacity', String(pose.bodyAlpha));
    eyes.forEach((eye, i) => {
      const value = pose.eyes[i];
      eye.setAttribute('d', value?.d ?? '');
      eye.setAttribute('transform', value?.matrix ?? '');
      eye.setAttribute('opacity', String((value?.alpha ?? 0) * pose.bodyAlpha));
    });
    dots.replaceChildren(...pose.dots.map(dot => {
      const node = document.createElementNS(ns, dot.d ? 'path' : 'circle');
      const attrs = dot.d ? {d:dot.d} : {cx:dot.x,cy:dot.y,r:dot.r};
      for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
      node.setAttribute('opacity',String(dot.opacity ?? 1));
      return node;
    }));
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || reduced.matches) return;
    if (now - last >= 1000 / 30) {
      clock += Math.min((now - (last || now)) / 1000, .1);
      last = now; render(clock);
    }
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!frame && !document.hidden && !reduced.matches) { last=0; frame=requestAnimationFrame(tick); }
  }
  function apply(renderNow = true) {
    const [animation,expression] = poked ? ['wink','fier'] : speaking ? ['idle','heureux'] : moods[state] ?? moods.idle;
    svg.dataset.expression = poked ? 'wink' : speaking ? 'speaking' : state;
    svg.setAttribute('aria-label', `Vault face: ${svg.dataset.expression}`);
    if (reduced.matches) {
      engine = new BotEngine(100,animation,null,EXPRESSION_BY_ID.get(expression));
      render(1.2);
    } else {
      engine.setExpression(EXPRESSION_BY_ID.get(expression),clock);
      engine.setState(animation,clock);
      if (renderNow) { render(clock); start(); }
    }
  }
  function setState(value) {
    pointerDirty = Boolean(pointer);
    if (!['idle','watching','locked','sleep'].includes(value)) engine.setLook(null,clock);
    clearTimeout(sleepTimer); state=value; poked=false; apply();
    if (value==='idle') sleepTimer=setTimeout(()=>{state='sleep';apply();},24000);
  }
  function gaze(x, y) {
    if (reduced.matches || !['idle','watching','locked','sleep'].includes(state) || !Number.isFinite(x + y)) return;
    if (state === 'sleep') { state='idle'; poked=false; apply(false); }
    if (state === 'idle') {
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => { state='sleep'; apply(); }, 24000);
    }
    // Screen y grows downwards; the engine's positive pitch looks UP.
    engine.setLook({yaw:Math.max(-1,Math.min(1,x))*30,pitch:-Math.max(-1,Math.min(1,y))*20,mix:1,spin:0,wander:0},clock);
  }
  function resetGaze() {
    pointer = null; pointerDirty = false;
    engine.setLook({yaw:0,pitch:0,mix:0,spin:0,wander:1},clock);
  }
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reduced.matches || document.hidden) return;
    pointer = {x:event.clientX,y:event.clientY}; pointerDirty = true;
  }, {passive:true});
  window.addEventListener('resize', () => { pointerDirty = Boolean(pointer); });
  window.addEventListener('blur', resetGaze);
  document.addEventListener('pointerleave', resetGaze);
  function visibility() { cancelAnimationFrame(frame);frame=0; if(!document.hidden){apply();start();} }
  document.addEventListener('visibilitychange',visibility);
  reduced.addEventListener('change',visibility);
  setState('idle');
  return {
    setState,
    setSpeaking(value) { speaking=value; apply(); },
    poke(value) { poked=value; apply(); },
    gaze, resetGaze
  };
}
