const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'light' ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content =
    theme === 'light' ? '#f6f8fa' : '#0f1117';
  localStorage.setItem('seedsong-theme', theme);
}

export function initTheme(onToggle) {
  const saved = localStorage.getItem('seedsong-theme') || 'dark';
  applyTheme(saved);

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    onToggle();
  });
}
