use tauri::{window::Color, WebviewUrl, WebviewWindowBuilder};

// CSS edited in src/wrapper.css — Cargo rebuilds when the file changes.
const WRAPPER_CSS: &str = include_str!("wrapper.css");

const INIT_SCRIPT_TEMPLATE: &str = include_str!("wrapper.js");

fn build_init_script() -> String {
    let css_literal = serde_json::to_string(WRAPPER_CSS).expect("CSS serializes");
    INIT_SCRIPT_TEMPLATE
        .replace(
            "\"__WRAPPER_PLATFORM__\"",
            if cfg!(target_os = "macos") {
                "\"macos\""
            } else {
                "\"other\""
            },
        )
        .replace("\"__WRAPPER_CSS__\"", &css_literal)
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
            .min_inner_size(1000.0, 600.0)
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
