const VIEWS = ['generator', 'explore', 'compose', 'learn'];
const DEFAULT_VIEW = 'generator';

const listeners = [];

export function getActiveView() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return VIEWS.includes(hash) ? hash : DEFAULT_VIEW;
}

export function onViewChange(cb) {
  listeners.push(cb);
}

function applyView(view) {
  for (const v of VIEWS) {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== view);
  }
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
  });
  const host = document.getElementById('daw-main');
  if (host) host.dataset.activeView = view;
  // Hide transport bar / piano drawer outside Generator view
  const transport = document.getElementById('transport-bar');
  const piano = document.getElementById('piano-drawer');
  if (transport) transport.classList.toggle('view-hidden', view !== 'generator');
  if (piano) piano.classList.toggle('view-hidden', view !== 'generator');
  for (const cb of listeners) cb(view);
}

export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');

  function isMobile() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function open() {
    sidebar.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    if (isMobile()) {
      if (backdrop) {
        backdrop.hidden = false;
        requestAnimationFrame(() => backdrop.classList.add('visible'));
      }
    } else {
      document.body.classList.add('sidebar-open');
    }
  }

  function close() {
    sidebar.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-open');
    if (backdrop) {
      backdrop.classList.remove('visible');
      setTimeout(() => { backdrop.hidden = true; }, 220);
    }
  }

  function toggleSidebar() {
    if (sidebar.classList.contains('open')) close();
    else open();
  }

  toggle.addEventListener('click', toggleSidebar);
  const closeBtn = document.getElementById('sidebar-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open') && isMobile()) close();
  });

  // Sidebar link click → close on mobile
  sidebar.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link[data-view]');
    if (link && isMobile()) close();
  });

  // Hash router
  window.addEventListener('hashchange', () => applyView(getActiveView()));

  // Initial view
  applyView(getActiveView());

  // Open by default on desktop, closed on mobile
  if (!isMobile()) {
    open();
  }
}
