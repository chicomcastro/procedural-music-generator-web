// Global support file — runs before every spec.
// Stub things that interfere with Cypress page loads (service worker,
// CDN script for OSMD) and silence known-noisy uncaught errors.

Cypress.on('window:before:load', (win) => {
  // The app registers a service worker on load; SW caches make
  // cy.visit re-visits flaky because the load event never settles
  // the way Cypress expects. Stub registration to a noop.
  if (win.navigator?.serviceWorker) {
    Object.defineProperty(win.navigator, 'serviceWorker', {
      configurable: true,
      get: () => ({
        register: () => Promise.resolve({}),
        getRegistrations: () => Promise.resolve([]),
        ready: new Promise(() => {}),
      }),
    });
  }
});

// Suppress the inevitable AudioContext / mic / CDN warnings in headless Chrome.
Cypress.on('uncaught:exception', (err) => {
  if (/AudioContext|getUserMedia|MediaRecorder|opensheetmusicdisplay|ServiceWorker/i.test(err.message || err)) {
    return false;
  }
  return true;
});

// Capture a screenshot at the end of every test (pass or fail). The CI sticky
// comment lists these so reviewers can see the visual state of each spec
// without downloading the full artifact zip. Failed tests already capture
// their own; this is the success-path counterpart.
afterEach(function () {
  if (this.currentTest?.state === 'passed') {
    const name = `${this.currentTest.title.replace(/[^\w\-]+/g, '_')}__pass`;
    cy.screenshot(name, { capture: 'viewport', overwrite: true, log: false });
  }
});
