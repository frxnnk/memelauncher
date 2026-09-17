import React from 'react';

export function FlyMascot(){
  return <svg viewBox="0 0 560 510" role="img" aria-label="Cartoon fly mascot reaching for an opening bell. Illustration, not neural data.">
    <defs><pattern id="eye-dots" width="13" height="13" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.3" fill="#7b211b"/></pattern></defs>
    <ellipse cx="295" cy="458" rx="196" ry="22" fill="#141a16" opacity=".13"/>
    <g className="fly-wings" fill="#f4f2df" stroke="#18221b" strokeWidth="6" strokeLinejoin="round">
      <path d="M269 230C65 195 59 32 141 51c60 15 113 94 128 179Z"/>
      <path d="M287 224C282 95 411 23 430 91c18 65-66 136-143 133Z"/>
      <path d="M134 88q73 72 121 124M399 94q-54 51-98 111" fill="none" strokeWidth="3"/>
    </g>
    <g fill="none" stroke="#17221c" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
      <path d="m239 317-69 46-24 66m151-101 25 79 58 34M227 276l-75 12-50-32m205 22 43 27 56-8M229 234l-63-24-38-34m184 58 44-25 21-46"/>
    </g>
    <ellipse cx="269" cy="310" rx="69" ry="91" fill="#202f24" stroke="#142018" strokeWidth="7" transform="rotate(-14 269 310)"/>
    <path d="m214 315 103-23m-94 57 97-22" stroke="#819641" strokeWidth="12"/>
    <ellipse cx="264" cy="219" rx="80" ry="66" fill="#a3ba55" stroke="#18221b" strokeWidth="7"/>
    <g fill="none" stroke="#18221b" strokeWidth="6" strokeLinecap="round"><path d="m241 166-19-44-24-10m79 50 14-41 28-13"/></g>
    <g stroke="#18221b" strokeWidth="6"><ellipse cx="221" cy="202" rx="43" ry="56" fill="#f47259" transform="rotate(-19 221 202)"/><ellipse cx="298" cy="192" rx="45" ry="58" fill="#f47259" transform="rotate(13 298 192)"/></g>
    <ellipse cx="221" cy="202" rx="39" ry="51" fill="url(#eye-dots)" transform="rotate(-19 221 202)"/>
    <ellipse cx="298" cy="192" rx="41" ry="53" fill="url(#eye-dots)" transform="rotate(13 298 192)"/>
    <path d="m188 187 62 8m15-14 68-16" stroke="#18221b" strokeWidth="12" strokeLinecap="round"/>
    <path d="m252 249q17 13 29-4" fill="none" stroke="#18221b" strokeWidth="5" strokeLinecap="round"/>
    <g stroke="#18221b" strokeWidth="6" strokeLinejoin="round"><path d="M364 409c23-31 31-46 31-76a41 41 0 0 1 82 0c0 30 8 45 31 76Z" fill="#edbe59"/><path d="M354 410h163v19H354z" fill="#18221b"/><circle cx="436" cy="281" r="9" fill="#edbe59"/><path d="M421 437q16 21 31 0" fill="#edbe59"/></g>
    <path d="m498 317 25-13m-14 49 28-1M383 297l-19-16" stroke="#18221b" strokeWidth="6" strokeLinecap="round"/>
    <path d="m112 437 39-7m213 14 30 3" stroke="#18221b" strokeWidth="12" strokeLinecap="round"/>
  </svg>;
}

export function MemeHero(){
  return <><section className="coin-opening" id="experiment"><div className="coin-topline"><span>TINY BRAIN. BIG LAUNCH.</span><span className="coin-status">PRELAUNCH / LOCAL EXPERIMENT</span></div><div className="coin-wordmark" aria-label="BELLFLY">BELLFLY<span aria-hidden="true">✳</span></div><p className="coin-caption">WORKING NAME · TICKER UNDECIDED · NO TOKEN ISSUED</p><a className="coin-route" href="#launch">Proposed: Robinhood Chain ↗</a></section><section className="hero">
    <div className="hero-copy"><div className="eyebrow"><span className="pill">PRELAUNCH EXPERIMENT</span> LITTLE FLY. QUESTIONABLE AMBITION.</div>
      <h1>Let the fly<br/>ring <em>the bell.</em></h1>
      <p className="intro">Give a simulated fly the opening bell.<br/>Let its neural signal trigger a memecoin launch.</p>
      <p className="hero-status">That’s the experiment. The model runs. The token hasn’t launched.</p>
      <div className="hero-links"><a href="#signal" className="primary">Watch the fly <span>↘</span></a><a href="#launch" className="secondary">What’s left to launch? ↗</a></div>
      <div className="hero-footnote"><span className="dot"/> ACTUAL MODEL · FIXED RULES · RECEIPTS OR IT DIDN’T HAPPEN</div>
    </div>
    <div className="mascot-stage"><span className="orbit-copy">THE FLY HAS ONE JOB.</span><div className="mascot-disc"/><FlyMascot/><span className="sticker">LET HIM<br/>RING.</span><span className="mascot-label">OUR MASCOT. NOT A BRAIN SCAN.</span></div>
  </section><div className="meme-tape" aria-label="Project theme"><span>LESS ROADMAP. MORE FRUIT FLY.</span><b>✳</b><span>THE SIGNAL COMES FIRST.</span><b>✳</b><span>THE TOKEN COMES AFTER.</span></div>
  <section className="origin-story"><div><div className="eyebrow">MEET BELLFLY / WORKING NAME</div><h2>A memecoin with<br/>a very small trigger.</h2></div><div><p>Most coins start with someone clicking launch. We want this one to start with a fly’s neural signal.</p><p>A published model produces spikes. A rule set beforehand says launch or don’t. A separate executor would create the token. The fly doesn’t pick a ticker, understand markets, or promise you anything.</p><a href="#rules">Absurd premise. Inspectable experiment. ↓</a></div></section></>;
}

const steps=[
  {n:'01',state:'WORKS LOCALLY',title:'The fly makes a signal.',body:'The reference model, quiet control and disconnected-output control ran. Their recorded outcomes can be inspected and replayed.',kind:'done'},
  {n:'02',state:'INTEGRATION REVIEW',title:'Connect the launcher.',body:'A separate Long preparer now encodes BELLFLY / GOOGL. Its diagnostic call reverted: the reviewed factory is paused. A successful launch simulation is still pending.',kind:'next'},
  {n:'03',state:'TO BE FIXED',title:'Give the token its terms.',body:'Finalize name, ticker, supply, quote, fees, recipients and gas budget. No presale, creator allocation or own first buy is the proposal—not a live token configuration.',kind:'pending'},
  {n:'04',state:'PROTOCOL PREPARED',title:'Lock the rules. Run once.',body:'Publish the commitment first, use the agreed future public seed and record every outcome. Authorize the exact run before it starts. No reroll for a better answer.',kind:'pending'},
  {n:'05',state:'NOT CONNECTED',title:'Signal → transaction → proof.',body:'The executor submits once only after a verified signal, reconciles uncertain results and checks the onchain receipt. Then—and only then—show the real token and pool.',kind:'pending'},
];

export function LaunchPath(){
  return <section className="launch-path" id="launch"><div className="section-heading"><div><div className="eyebrow">FROM BUZZ TO BROADCAST</div><h2>The fly works.<br/><em>The launch bridge is next.</em></h2></div><span className="plan-date">BUILD STATUS / 10 SEP 2026<br/>ENGINEERING REVIEW · NOT LIVE TELEMETRY</span></div>
    <div className="launch-summary"><span>ROUTE UNDER REVIEW</span><strong>Long → GOOGL</strong><p>Robinhood Chain. GOOGL is the selected quote for preparation. The reviewed factory was paused on 10 Sep 2026; launch compatibility remains unconfirmed.</p></div>
    <div className="launch-steps">{steps.map(step=><article key={step.n} className={step.kind}><span className="step-number">{step.n}</span><div><span className="step-state">{step.state}</span><h3>{step.title}</h3><p>{step.body}</p></div><span className="step-symbol" aria-hidden="true">{step.kind==='done'?'✓':step.kind==='next'?'↗':'○'}</span></article>)}</div>
    <div className="launch-notes"><p><b>Not just flipping a switch.</b> The current build has no signer or live executor. A positive rehearsal can only reach an offline preview.</p><p><b>Before the public run.</b> Confirm dataset terms for the actual experiment and provider eligibility. A local rehearsal is not an official public launch.</p></div>
  </section>;
}
