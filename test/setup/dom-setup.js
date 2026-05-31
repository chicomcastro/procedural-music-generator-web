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

// jsdom doesn't implement scrollIntoView, which Onboarding + several UI
// modules call when highlighting a step / element.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () { /* no-op in jsdom */ };
}

// jsdom ships HTMLCanvasElement without a 2d implementation. Stub it so
// ExploreView / ScoreCanvas / Onboarding paths that draw a small preview
// don't throw. Returns a minimal context object covering the methods +
// state our UI code touches.
if (typeof HTMLCanvasElement !== 'undefined') {
  const stubCtx = {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1,
    fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {}, stroke() {}, fill() {},
    fillText() {}, strokeText() {}, measureText() { return { width: 0 }; },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {},
    drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; },
    putImageData() {}, createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    setLineDash() {}, getLineDash() { return []; },
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {},
    isPointInPath() { return false; }, isPointInStroke() { return false; },
  };
  HTMLCanvasElement.prototype.getContext = function () { return { ...stubCtx, canvas: this }; };
  HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
  HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob([], { type: 'image/png' })); };
}

// PointerEvent isn't in jsdom; fall back to MouseEvent for the tests.
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId || 0;
      this.pointerType = init.pointerType || 'mouse';
    }
  };
}
