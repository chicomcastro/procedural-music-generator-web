// Shared jsdom setup. Most tests don't need anything beyond what jsdom
// already provides; this file exists so individual tests can import shared
// helpers and so we have a single place to stub the Web Audio API surface
// that LearnView and AudioEngine touch.

// Web Audio is the only API jsdom doesn't ship. Tests that need it can do
// their own per-test mocks; this default just keeps `window.AudioContext`
// callable so module-level audio engines don't blow up at import time.
if (typeof globalThis.AudioContext === 'undefined') {
  // eslint-disable-next-line no-unused-vars
  globalThis.AudioContext = class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = { connect() {}, disconnect() {} };
      this.state = 'suspended';
    }
    createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {} }, type: 'sine' }; }
    createGain() { return { connect() {}, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createBiquadFilter() { return { connect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: 'lowpass' }; }
    createDelay() { return { connect() {}, delayTime: { value: 0 } }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { connect() {}, fftSize: 2048, getFloatTimeDomainData() {} }; }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
  globalThis.webkitAudioContext = globalThis.AudioContext;
}

if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
}
