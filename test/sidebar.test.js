import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveView, onViewChange, initSidebar } from '../src/js/ui/Sidebar.js';

function buildSidebarDom() {
  document.body.innerHTML = `
    <button id="sidebar-toggle" aria-expanded="false"></button>
    <button id="sidebar-close"></button>
    <div id="sidebar-backdrop" hidden></div>
    <aside id="sidebar">
      <a class="sidebar-link" data-view="generator" href="#/generator">Gen</a>
      <a class="sidebar-link" data-view="learn" href="#/learn">Learn</a>
    </aside>
    <main id="daw-main"></main>
    <section id="view-generator"></section>
    <section id="view-learn" class="hidden"></section>
    <section id="view-explore" class="hidden"></section>
    <section id="view-radio" class="hidden"></section>
    <section id="view-compose" class="hidden"></section>
    <section id="view-practice" class="hidden"></section>
    <section id="view-settings" class="hidden"></section>
    <div id="transport-bar"></div>
    <div id="piano-drawer"></div>
  `;
}

beforeEach(() => {
  buildSidebarDom();
  location.hash = '';
});

describe('Sidebar', () => {
  it('getActiveView returns the default (practice, per ADR 0005) when no hash is set', () => {
    location.hash = '';
    expect(getActiveView()).toBe('practice');
  });

  it('getActiveView reads the hash, ignoring unknown values', () => {
    location.hash = '#/learn';
    expect(getActiveView()).toBe('learn');
    location.hash = '#/bogus';
    expect(getActiveView()).toBe('practice');
    // Explore left the nav but its deep-link route must keep working.
    location.hash = '#/explore';
    expect(getActiveView()).toBe('explore');
  });

  it('getActiveView strips query strings and sub-paths from the hash', () => {
    location.hash = '#/practice?study=foo&seed=42';
    expect(getActiveView()).toBe('practice');
    location.hash = '#/learn/some/sub';
    expect(getActiveView()).toBe('learn');
  });

  it('initSidebar hides non-active views and marks the active sidebar link', () => {
    location.hash = '#/learn';
    initSidebar();
    expect(document.getElementById('view-learn').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('view-generator').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('[data-view="learn"]').classList.contains('active')).toBe(true);
  });

  it('initSidebar toggles open/closed when the toggle button is clicked', () => {
    location.hash = '#/generator';
    initSidebar();
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    // On desktop (matchMedia returns false for "max-width: 900px") sidebar
    // starts open via the default branch.
    const wasOpen = sidebar.classList.contains('open');
    toggle.click();
    expect(sidebar.classList.contains('open')).toBe(!wasOpen);
    toggle.click();
    expect(sidebar.classList.contains('open')).toBe(wasOpen);
  });

  it('hashchange events update the active view', () => {
    location.hash = '#/generator';
    initSidebar();
    location.hash = '#/learn';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.getElementById('view-learn').classList.contains('hidden')).toBe(false);
  });

  it('onViewChange listeners fire when applyView runs', () => {
    location.hash = '#/generator';
    let lastView = null;
    onViewChange(v => { lastView = v; });
    initSidebar();
    expect(lastView).toBe('generator');
    location.hash = '#/learn';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(lastView).toBe('learn');
  });

  it('hides the transport bar + piano drawer for non-generator views', () => {
    location.hash = '#/learn';
    initSidebar();
    expect(document.getElementById('transport-bar').classList.contains('view-hidden')).toBe(true);
    expect(document.getElementById('piano-drawer').classList.contains('view-hidden')).toBe(true);
  });

  it('sidebar-close button closes the sidebar', () => {
    location.hash = '#/generator';
    initSidebar();
    document.getElementById('sidebar-toggle').click();
    // ensure open
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-close').click();
    expect(document.getElementById('sidebar').classList.contains('open')).toBe(false);
  });
});
