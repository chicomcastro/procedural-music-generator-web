// Global support file — runs before every spec.
// Stub the AudioContext / mic / OSMD CDN so tests don't depend on
// network or audio hardware.

beforeEach(() => {
  cy.window().then((win) => {
    // Mark onboarding as already done so the tour doesn't pop up.
    win.localStorage.setItem('seedsong-onboarding-done', '1');
  });
});

// Suppress the inevitable AudioContext warnings in headless Chrome.
Cypress.on('uncaught:exception', (err) => {
  if (/AudioContext|getUserMedia|MediaRecorder|opensheetmusicdisplay/i.test(err.message)) {
    return false;
  }
  return true;
});
