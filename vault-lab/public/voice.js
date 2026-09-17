// One controller per page. The caller supplies an actual reply to speak(); toggling never invents dialogue.
// onSpeaking(boolean) drives the mouth; onStatus(string) provides a visible or accessible status.
export function createVoice({ onSpeaking = () => {}, onStatus = () => {} } = {}) {
  const synth = globalThis.speechSynthesis;
  const Utterance = globalThis.SpeechSynthesisUtterance;
  const hasApi = Boolean(synth && typeof synth.getVoices === 'function'
    && typeof synth.speak === 'function' && typeof synth.cancel === 'function'
    && typeof Utterance === 'function');
  let voice = null, enabled = false, active = null, speaking = false, revision = 0;

  function setSpeaking(value) {
    speaking = value;
    onSpeaking(value);
  }

  function reportStatus() {
    if (!hasApi) onStatus('Local voice playback is not supported by this browser.');
    else if (!voice) onStatus('No local English voice is available in this browser. Voice stays off.');
    else if (!enabled) onStatus('Voice is off. A local English voice is available.');
    else if (speaking) onStatus('Reading the reply with a local English voice.');
    else onStatus('Voice is on. Using an English voice reported as local by your browser.');
  }

  function cancelCurrent() {
    // Invalidate callbacks before cancel(): browsers can emit error/end during or after cancellation.
    revision += 1;
    const previous = active;
    active = null;
    if (previous) {
      previous.onstart = previous.onend = previous.onerror = null;
      try { synth.cancel(); } catch { /* The mouth still closes if the browser rejects cancellation. */ }
    }
    setSpeaking(false);
  }

  function refreshVoices(notify = true) {
    let voices = [];
    if (hasApi) {
      try { voices = synth.getVoices().filter(item => item.localService === true && /^en(?:[-_]|$)/i.test(item.lang)); }
      catch { /* No eligible voice means no playback, including no browser-default fallback. */ }
    }
    voice = voices.find(item => item.default)
      || voices.find(item => /^en-US$/i.test(item.lang)) || voices[0] || null;
    if (!voice && enabled) { enabled = false; cancelCurrent(); }
    if (notify) reportStatus();
  }

  function stop() {
    cancelCurrent();
    reportStatus();
  }

  function toggle() {
    if (enabled) {
      enabled = false;
      cancelCurrent();
    } else {
      refreshVoices(false);
      enabled = Boolean(voice);
    }
    reportStatus();
    return enabled;
  }

  function speak(text) {
    if (!enabled) return false;
    if (typeof text !== 'string' || !text.trim()) {
      onStatus('No reply is available to read.');
      return false;
    }
    if (globalThis.document?.hidden) {
      stop();
      onStatus('Voice playback is stopped while this tab is hidden.');
      return false;
    }
    refreshVoices(false);
    if (!voice) { reportStatus(); return false; }
    cancelCurrent();
    const current = revision;
    try {
      const utterance = new Utterance(text);
      // Never leave voice unset: a browser default could use a remote speech service.
      utterance.voice = voice;
      utterance.lang = voice.lang;
      active = utterance;
      const isCurrent = () => current === revision && active === utterance;
      utterance.onstart = () => {
        if (!isCurrent()) return;
        setSpeaking(true);
        reportStatus();
      };
      utterance.onend = () => {
        if (!isCurrent()) return;
        active = null;
        setSpeaking(false);
        reportStatus();
      };
      utterance.onerror = event => {
        if (!isCurrent()) return;
        active = null;
        enabled = false;
        setSpeaking(false);
        onStatus(event.error === 'not-allowed'
          ? 'Your browser blocked voice playback. Use the voice button to try again.'
          : 'Local voice playback failed. Voice is off; you can enable it to try again.');
      };
      synth.speak(utterance);
      return enabled;
    } catch {
      enabled = false;
      cancelCurrent();
      onStatus('Local voice playback could not start. Voice is off.');
      return false;
    }
  }

  refreshVoices(false);
  synth?.addEventListener?.('voiceschanged', () => refreshVoices());
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (globalThis.document.hidden) stop();
  });
  globalThis.addEventListener?.('pagehide', () => {
    enabled = false;
    stop();
  });
  // Defer initial callbacks so the caller can assign the controller before inspecting its getters.
  queueMicrotask(() => { onSpeaking(speaking); reportStatus(); });

  return {
    toggle, speak, stop,
    get enabled() { return enabled; },
    get supported() { return Boolean(voice); }
  };
}
