use tauri::{window::Color, WebviewUrl, WebviewWindowBuilder};

// CSS edited in src/wrapper.css — Cargo rebuilds when the file changes.
const WRAPPER_CSS: &str = include_str!("wrapper.css");

const INIT_SCRIPT_TEMPLATE: &str = r#"
(function () {
  if (document.documentElement.dataset.pandoraWrapper) return;
  document.documentElement.dataset.pandoraWrapper = '1';

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

  const backLink = document.createElement('a');
  backLink.className = 'NavHorizontal__item__link';
  backLink.setAttribute('role', 'button');
  backLink.setAttribute('aria-label', 'Back');
  // No href — keeps default user-agent anchor color out of the cascade.

  // Mirror the structure of sibling nav items (<a><span>label</span></a>)
  // so Pandora's existing nav styling applies automatically.
  const backSpan = document.createElement('span');
  backSpan.textContent = '❮';
  backLink.appendChild(backSpan);
  backLi.appendChild(backLink);

  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.history.back();
  });

  const updateBackVisibility = () => {
    backLi.style.display = isTopLevel() ? 'none' : '';
  };
  updateBackVisibility();

  const ensureBackBtn = () => {
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
})();
"#;

fn build_init_script() -> String {
    let css_literal = serde_json::to_string(WRAPPER_CSS).expect("CSS serializes");
    INIT_SCRIPT_TEMPLATE.replace("\"__WRAPPER_CSS__\"", &css_literal)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let init_script = build_init_script();
    tauri::Builder::default()
        .setup(move |app| {
            #[allow(unused_mut)]
            let mut builder = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("https://www.pandora.com/".parse().unwrap()),
            )
            .title("Pandora")
            .inner_size(1200.0, 820.0)
            .min_inner_size(900.0, 600.0)
            .background_color(Color(255, 255, 255, 255))
            .initialization_script(&init_script);

            #[cfg(target_os = "macos")]
            {
                builder = builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true);
            }

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
