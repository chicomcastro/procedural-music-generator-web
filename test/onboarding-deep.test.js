// Deep-coverage tests for the onboarding flow — every step transition,
// keyboard binding, and exit path. ui-small-views.test.js already
// smoke-covers initial mount; this file walks through the whole
// state machine.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'seedsong-onboarding-done';

// Onboarding's renderStep schedules content via setTimeout(300). Wait
// for that to land + a small grace window. Polls instead of fixed-delay
// to be CI-runtime tolerant (the previous fixed 350ms tripped on the
// slower GitHub Actions runner).
async function settle(maxWaitMs = 1500) {
  // Wait for the latest content tick — the step-num span is what
  // renderStep writes inside its setTimeout. We resolve as soon as it's
  // up to date, or fall through at maxWaitMs.
  const deadline = Date.now() + maxWaitMs;
  await new Promise(r => setTimeout(r, 320));   // pass the 300ms setTimeout
  while (Date.now() < deadline) {
    if (document.querySelector('.onboarding-step-num')) return;
    await new Promise(r => setTimeout(r, 50));
  }
}

function scaffoldDom() {
  document.body.innerHTML = `
    <div id="sidebar-toggle"></div>
    <div id="presets-row"></div>
    <div id="score-section"></div>
    <a class="sidebar-link" data-view="explore"></a>
    <a class="sidebar-link" data-view="radio"></a>
    <a class="sidebar-link" data-view="learn"></a>
    <a class="sidebar-link" data-view="compose"></a>
    <a class="sidebar-link" data-view="settings"></a>
  `;
}

beforeEach(() => {
  scaffoldDom();
  localStorage.clear();
  location.hash = '';
  // Fresh module instance so the internal currentStep/backdrop/cardEl
  // pointers don't bleed between tests.
  vi.resetModules();
});

describe('Onboarding — full flow', () => {
  it('shouldShowOnboarding returns true when the storage marker is absent', async () => {
    const { shouldShowOnboarding } = await import('../src/js/ui/Onboarding.js');
    expect(shouldShowOnboarding()).toBe(true);
    localStorage.setItem(STORAGE_KEY, '1');
    expect(shouldShowOnboarding()).toBe(false);
  });

  it('startOnboarding mounts a backdrop + card with step 1', async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding();
    expect(document.querySelector('.onboarding-backdrop')).toBeTruthy();
    await settle();
    expect(document.querySelector('.onboarding-step-num').textContent).toMatch(/1 \/ \d+/);
  });

  it('startOnboarding ignores re-entry while the overlay is already mounted', async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding();
    await settle();
    const firstCard = document.querySelector('.onboarding-card');
    startOnboarding();
    expect(document.querySelectorAll('.onboarding-card').length).toBe(1);
    expect(document.querySelector('.onboarding-card')).toBe(firstCard);
  });

  it('Next button advances steps and Prev returns', async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding();
    await settle();
    document.querySelector('.onboarding-next').click();
    await settle();
    expect(document.querySelector('.onboarding-step-num').textContent).toMatch(/2 \//);
    document.querySelector('.onboarding-prev').click();
    await settle();
    expect(document.querySelector('.onboarding-step-num').textContent).toMatch(/1 \//);
  });

  it('Skip button marks the localStorage flag + removes the overlay', async () => {
    const onFinish = vi.fn();
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding({ onFinish });
    await settle();
    document.querySelector('.onboarding-skip').click();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    expect(document.querySelector('.onboarding-backdrop')).toBeFalsy();
    expect(document.querySelector('.onboarding-card')).toBeFalsy();
    expect(onFinish).toHaveBeenCalled();
  });

  it('Clicking the backdrop advances to the next step', async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding();
    await settle();
    const backdrop = document.querySelector('.onboarding-backdrop');
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(document.querySelector('.onboarding-step-num').textContent).toMatch(/2 \//);
  });

  it('ArrowRight + Enter advance, ArrowLeft retreats, Escape finishes', async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding();
    await settle();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await settle();
    expect(document.querySelector('.onboarding-step-num').textContent).toMatch(/2 \//);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(document.querySelector('.onboarding-step-num').textContent).toMatch(/3 \//);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await settle();
    expect(document.querySelector('.onboarding-step-num').textContent).toMatch(/2 \//);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('keyboard handlers are no-ops once the overlay is gone', async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding();
    await settle();
    document.querySelector('.onboarding-skip').click();   // finish
    expect(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).not.toThrow();
    expect(document.querySelector('.onboarding-card')).toBeFalsy();
  });

  it('walking through every step ends on the finish button + setLocalStorage', { timeout: 15000 }, async () => {
    const { startOnboarding } = await import('../src/js/ui/Onboarding.js');
    startOnboarding();
    // STEPS.length is 9 — cap a little above to be safe but not 20.
    for (let i = 0; i < 12; i++) {
      await settle();
      const nextBtn = document.querySelector('.onboarding-next');
      if (!nextBtn) break;
      nextBtn.click();
    }
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });
});
