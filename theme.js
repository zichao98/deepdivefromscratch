/* ============================================================
   Shared theme toggle — light / dark
   Persists choice in localStorage and syncs across tabs.
   Must be loaded in <head> before render to avoid FOUC.
   ============================================================ */

(function () {
  var STORAGE_KEY = 'ddfs-theme';

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStoredTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
  }

  function getPreferredTheme() {
    var stored = getStoredTheme();
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateToggleIcons(theme);
  }

  function updateToggleIcons(theme) {
    if (!theme) theme = document.documentElement.getAttribute('data-theme');
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      var sun = btn.querySelector('.theme-icon-sun');
      var moon = btn.querySelector('.theme-icon-moon');
      if (sun) sun.style.display = theme === 'dark' ? 'none' : 'inline';
      if (moon) moon.style.display = theme === 'dark' ? 'inline' : 'none';
    });
  }

  // Apply immediately (called in <head> via the inline bootstrap below)
  applyTheme(getPreferredTheme());

  // Expose functions for buttons and inline scripts to call
  window.DDFS = window.DDFS || {};
  window.DDFS.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    setStoredTheme(next);
    applyTheme(next);
  };
  window.DDFS.updateToggleIcons = updateToggleIcons;

  // Sync across tabs — update both theme and icons
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      applyTheme(e.newValue);
    }
  });

  // Update icons after DOM is ready (buttons may not exist yet when script runs in <head>)
  document.addEventListener('DOMContentLoaded', function () {
    updateToggleIcons();
  });
})();
