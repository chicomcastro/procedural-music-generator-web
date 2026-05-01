const overlay = document.getElementById('shortcuts-overlay');
const closeBtn = document.getElementById('close-shortcuts');
const triggerBtn = document.getElementById('shortcuts-btn');

function toggle() {
  overlay.classList.toggle('hidden');
}

export function initShortcuts({ onPlay, onStop, onRandomize }) {
  triggerBtn.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) toggle();
  });

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === '?') {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      toggle();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      onPlay();
      return;
    }
    if (e.key === 'Escape') {
      onStop();
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      onRandomize();
      return;
    }
  });
}
