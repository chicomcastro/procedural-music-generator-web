import { t } from '../i18n/i18n.js';

const STORAGE_KEY = 'seedsong-onboarding-done';

// Each step's title/text live in i18n keys onboarding.<key>.title / .text.
// Updated to cover the current sidebar-based app instead of the old tabs flow.
// ADR 0005 (practice-first): the tour starts at Practice (the home view),
// walks through Learn, then presents the Generator as the engine playground.
const STEPS = [
  { key: 'welcome',   target: null,                                       position: 'center' },
  { key: 'sidebar',   target: '#sidebar-toggle',                          position: 'right' },
  { key: 'practice',  target: '.sidebar-link[data-view="practice"]',      position: 'right',  activateView: 'practice' },
  { key: 'learn',     target: '.sidebar-link[data-view="learn"]',         position: 'right',  activateView: 'learn' },
  { key: 'generator', target: '#presets-row',                             position: 'bottom', activateView: 'generator' },
  { key: 'score',     target: '#score-section',                           position: 'bottom', activateView: 'generator' },
  { key: 'settings',  target: '.sidebar-link[data-view="settings"]',      position: 'right',  activateView: 'settings' },
];

let currentStep = 0;
let backdropEl = null;
let cardEl = null;
let onFinishCb = null;

function createElements() {
  backdropEl = document.createElement('div');
  backdropEl.className = 'onboarding-backdrop';
  backdropEl.addEventListener('click', (e) => {
    if (e.target === backdropEl) next();
  });

  cardEl = document.createElement('div');
  cardEl.className = 'onboarding-card';
  document.body.appendChild(backdropEl);
  document.body.appendChild(cardEl);
}

function cleanup() {
  document.querySelectorAll('.onboarding-spotlight').forEach(el => {
    el.classList.remove('onboarding-spotlight');
    el.style.removeProperty('position');
    el.style.removeProperty('z-index');
  });
}

function activateView(viewName) {
  if (!viewName) return;
  // Navigate via the hash route so Sidebar's view-change pipeline fires.
  window.location.hash = `#/${viewName}`;
}

function renderStep() {
  cleanup();
  const step = STEPS[currentStep];

  if (step.activateView) activateView(step.activateView);

  const target = step.target ? document.querySelector(step.target) : null;

  cardEl.classList.remove('visible');
  cardEl.style.transition = 'opacity 150ms';
  cardEl.style.opacity = '0';

  if (target) {
    target.classList.add('onboarding-spotlight');
    const cs = getComputedStyle(target);
    if (cs.position === 'static') target.style.position = 'relative';
    target.style.zIndex = '201';
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  setTimeout(() => {
    const stepNum = `${currentStep + 1} / ${STEPS.length}`;
    const isFirst = currentStep === 0;
    const isLast = currentStep === STEPS.length - 1;

    const title = t(`onboarding.${step.key}.title`);
    const text = t(`onboarding.${step.key}.text`);
    cardEl.innerHTML = `
      <div class="onboarding-step-num">${stepNum}</div>
      <div class="onboarding-title">${title}</div>
      <div class="onboarding-text">${text}</div>
      <div class="onboarding-progress">
        ${STEPS.map((_, i) => `<span class="onboarding-dot${i === currentStep ? ' active' : i < currentStep ? ' done' : ''}"></span>`).join('')}
      </div>
      <div class="onboarding-actions">
        <button class="onboarding-skip" type="button">${t('onboarding.skip')}</button>
        <div class="onboarding-nav">
          ${isFirst ? '' : `<button class="onboarding-prev" type="button">${t('onboarding.back')}</button>`}
          <button class="onboarding-next" type="button">${isLast ? t('onboarding.finish') : t('onboarding.next')}</button>
        </div>
      </div>
    `;

    cardEl.querySelector('.onboarding-skip').addEventListener('click', finish);
    const prevBtn = cardEl.querySelector('.onboarding-prev');
    if (prevBtn) prevBtn.addEventListener('click', prev);
    cardEl.querySelector('.onboarding-next').addEventListener('click', next);

    positionCard(target, step.position);
    cardEl.style.opacity = '1';
    cardEl.classList.add('visible');
  }, 300);
}

function positionCard(target, position) {
  cardEl.style.position = 'fixed';
  cardEl.style.removeProperty('top');
  cardEl.style.removeProperty('bottom');
  cardEl.style.removeProperty('left');
  cardEl.style.removeProperty('right');
  cardEl.style.removeProperty('transform');

  if (!target) {
    cardEl.style.top = '50%';
    cardEl.style.left = '50%';
    cardEl.style.transform = 'translate(-50%, -50%)';
    return;
  }

  const rect = target.getBoundingClientRect();
  const cardW = Math.min(380, window.innerWidth - 32);
  const margin = 12;

  if (position === 'below-fixed') {
    cardEl.style.top = `${rect.bottom + margin}px`;
    cardEl.style.right = '16px';
    return;
  }

  let left = rect.left + rect.width / 2 - cardW / 2;
  left = Math.max(16, Math.min(left, window.innerWidth - cardW - 16));
  cardEl.style.left = `${left}px`;
  cardEl.style.width = `${cardW}px`;

  const cardH = 220;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const fitsBelow = spaceBelow >= cardH + margin;
  const preferTop = position === 'top' || (!fitsBelow && spaceAbove > spaceBelow);

  if (preferTop) {
    cardEl.style.top = `${Math.max(margin, rect.top - margin - cardH)}px`;
    cardEl.setAttribute('data-arrow', 'down');
  } else {
    cardEl.style.top = `${Math.min(rect.bottom + margin, window.innerHeight - cardH - margin)}px`;
    cardEl.setAttribute('data-arrow', 'up');
  }

  requestAnimationFrame(() => cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
}

function next() {
  if (currentStep < STEPS.length - 1) {
    currentStep++;
    renderStep();
  } else {
    finish();
  }
}

function prev() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
}

function finish() {
  cleanup();
  activateView('practice');
  window.removeEventListener('keydown', handleKeydown);
  backdropEl.remove();
  cardEl.remove();
  backdropEl = null;
  cardEl = null;
  localStorage.setItem(STORAGE_KEY, '1');
  if (onFinishCb) onFinishCb();
}

function handleKeydown(e) {
  if (!backdropEl) return;
  if (e.key === 'Escape') { finish(); e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'Enter') { next(); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { prev(); e.preventDefault(); }
}

export function startOnboarding({ onFinish } = {}) {
  if (backdropEl) return;
  currentStep = 0;
  onFinishCb = onFinish || null;
  createElements();
  renderStep();
  window.addEventListener('keydown', handleKeydown);
}

export function shouldShowOnboarding() {
  return !localStorage.getItem(STORAGE_KEY);
}
