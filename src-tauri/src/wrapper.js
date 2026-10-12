(function () {
  if (document.documentElement.dataset.pandoraWrapper) return;
  document.documentElement.dataset.pandoraWrapper = '1';
  document.documentElement.dataset.pandoraWrapperPlatform = "__WRAPPER_PLATFORM__";

  const css = "__WRAPPER_CSS__";
  const applyCss = () => {
    if (document.querySelector('style[data-pandora-wrapper]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-pandora-wrapper', '');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  };
  if (document.head) applyCss();
  else document.addEventListener('DOMContentLoaded', applyCss, { once: true });

  // Drag the window on mousedown over the topBar / title-bar area, except
  // when the click lands on an interactive element.
  const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable]';
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const topBar = document.querySelector('.region-topBar');
    const topBarBottom = topBar ? topBar.getBoundingClientRect().bottom : 28;
    if (e.clientY > topBarBottom) return;
    if (e.target.closest && e.target.closest(INTERACTIVE)) return;
    const invoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;
    if (!invoke) return;
    e.preventDefault();
    if (e.detail === 2) {
      invoke('plugin:window|internal_toggle_maximize').catch(() => {});
    } else {
      invoke('plugin:window|start_dragging').catch(() => {});
    }
  }, true);

  // Conditional back nav item. Inserted as the first child of Pandora's
  // top-nav (.NavHorizontal) so it inherits the existing styling.
  // Hidden on top-level routes, visible everywhere else.
  // Entries are either exact paths or `prefix/*` to match everything beneath.
  const TOP_LEVEL_ROUTES = [
    '/',
    '/station',
    '/collection',
    '/collection/all',
    '/collection/artists',
    '/collection/albums',
    '/collection/songs',
    '/collection/stations',
    '/collection/playlists',
    '/collection/podcasts',
    '/collection/episodes',
    '/browse',
    '/artist/play/*',
    '/station/play/*',
    '/search/*',
  ];
  const isTopLevel = () => {
    const p = window.location.pathname.replace(/\/+$/, '') || '/';
    return TOP_LEVEL_ROUTES.some((route) => {
      if (route.endsWith('/*')) {
        const prefix = route.slice(0, -2);
        return p === prefix || p.startsWith(prefix + '/');
      }
      return p === route;
    });
  };

  const backLi = document.createElement('li');
  backLi.className = 'NavHorizontal__item';
  backLi.setAttribute('data-pandora-wrapper-back', '');

  const backLink = document.createElement('button');
  backLink.className = 'NavHorizontal__item__link';
  backLink.type = 'button';
  backLink.setAttribute('aria-label', 'Back');

  // Keep the nav label structure; size the native button in wrapper.css so
  // Pandora's anchor-only styles and inherited font resets cannot hide it.
  const backSpan = document.createElement('span');
  backSpan.textContent = '❮';
  backLink.appendChild(backSpan);
  backLi.appendChild(backLink);

  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.history.back();
  });

  // Pandora handles Space globally. Keep activation on this button from
  // reaching its playback shortcut, and suppress the default duplicate click.
  backLink.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) backLink.click();
  });

  const updateBackVisibility = () => {
    backLi.style.display = isTopLevel() ? 'none' : '';
  };
  updateBackVisibility();

  const ensureBackBtn = () => {
    // Pandora can retain or replace history methods. Reconcile the current
    // route even when those calls bypass our hooks, including after re-renders.
    updateBackVisibility();
    const nav = document.querySelector('.NavHorizontal');
    if (!nav) return;
    if (backLi.parentElement === nav && nav.firstChild === backLi) return;
    nav.insertBefore(backLi, nav.firstChild);
  };

  // React may re-render the nav on route changes; re-insert if needed.
  // Cheap: one querySelector + identity check per tick.
  setInterval(ensureBackBtn, 500);
  if (document.body) ensureBackBtn();
  else document.addEventListener('DOMContentLoaded', ensureBackBtn, { once: true });

  const wrapHistory = (orig) => function () {
    const r = orig.apply(this, arguments);
    updateBackVisibility();
    return r;
  };
  history.pushState = wrapHistory(history.pushState);
  history.replaceState = wrapHistory(history.replaceState);
  window.addEventListener('popstate', updateBackVisibility);

  // Media key support — Pandora wires up play/pause handlers but not
  // next/previous track. Register our own that click Pandora's skip and
  // replay buttons.
  const clickByAria = (...patterns) => {
    // History cards have the same labels. Only operate on the current player.
    const player = document.querySelector('.Tuner .Tuner__Controls');
    if (!player) return false;
    const controls = [...player.querySelectorAll('button[aria-label], [role="button"][aria-label], [role="checkbox"][aria-label], input[type="checkbox"][aria-label], [role="switch"][aria-label]')]
      .filter((button) => !button.disabled && button.getAttribute('aria-disabled') !== 'true'
        && button.getClientRects().length > 0);
    // Exact labels take precedence. Only accept suffixes separated by a word
    // boundary so "Like" can never match "Dislike".
    for (const exact of [true, false]) {
      for (const pattern of patterns) {
        const label = pattern.toLowerCase();
        const button = controls.find((control) => {
          const value = control.getAttribute('aria-label').trim().toLowerCase();
          return exact ? value === label
            : value.startsWith(label) && /^[\s(:–—-]/.test(value.slice(label.length));
        });
        if (button) {
          button.click();
          return true;
        }
      }
    }
    return false;
  };

  const setupMediaKeys = () => {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      nexttrack: () => clickByAria('Skip', 'Next'),
      previoustrack: () => clickByAria('Replay', 'Previous'),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        // An unsupported action must not prevent registration of the others.
      }
    }
  };

  setupMediaKeys();
  // Re-register periodically in case Pandora overwrites our handlers.
  setInterval(setupMediaKeys, 5000);

  // Plain function keys are distinct from OS media-key events. Support both.
  const shortcutActions = {
    F7: () => clickByAria('Replay', 'Previous'),
    F8: () => clickByAria('Play', 'Pause'),
    F9: () => clickByAria('Skip', 'Next'),
    ArrowUp: () => clickByAria('Thumb up', 'Thumbs up', 'Like'),
    ArrowDown: () => clickByAria('Thumb down', 'Thumbs down', 'Dislike'),
  };
  document.addEventListener('keydown', (e) => {
    if (!Object.hasOwn(shortcutActions, e.key)) return;
    const t = e.target;
    if (!t) return;
    const tag = (t.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
    if (e.defaultPrevented || e.isComposing || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (t.closest('[role="slider"], [role="combobox"], [role="listbox"], [role="menu"], [role="tablist"], [role="tree"], [role="grid"]')) return;
    const clicked = shortcutActions[e.key]();
    if (clicked) e.preventDefault();
  }, true);
})();
