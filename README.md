# Pandora Wrapper

An unofficial desktop wrapper around [pandora.com](https://www.pandora.com) built with [Tauri](https://tauri.app). Runs Pandora's web player as a native-feeling app on macOS, Windows, and Linux.

> **Disclaimer:** This is an independent, unaffiliated project. It is not endorsed by, sponsored by, or otherwise associated with Pandora Media, LLC. "Pandora" and the Pandora logo are trademarks of Pandora Media, LLC; this project uses them solely to indicate compatibility. Pandora's service is currently only available in the United States and select other countries — this wrapper does not change that geo-restriction.

## Features

- Native window chrome on macOS (transparent title bar, traffic lights overlaid on Pandora's nav).
- Custom CSS injected to clean up the chrome (hidden scrollbars, top bar layout adjustments, splash screen suppressed).
- Conditional in-app back button that only appears on non-top-level routes.
- Drag the window from the top nav region (everywhere except interactive elements).
- No telemetry. No bundled tracking. The app is just a window pointed at `https://www.pandora.com/`.

## Install

Pre-built binaries are published as [GitHub Releases](https://github.com/scttymn/pandora-wrapper/releases). Download the artifact for your platform:

| Platform | Artifact |
| --- | --- |
| macOS (Apple Silicon) | `Pandora_<version>_aarch64.dmg` |
| macOS (Intel) | `Pandora_<version>_x64.dmg` |
| Windows | `Pandora_<version>_x64-setup.exe` or `Pandora_<version>_x64_en-US.msi` |
| Linux (Debian/Ubuntu) | `pandora-wrapper_<version>_amd64.deb` |
| Linux (other) | `pandora-wrapper_<version>_amd64.AppImage` |

### macOS first launch

Because the app is unsigned, macOS Gatekeeper will block it on first launch. After installing, run:

```sh
xattr -dr com.apple.quarantine /Applications/Pandora.app
```

Then launch normally.

## Build from source

You'll need:

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) 18+
- Platform-specific build prerequisites — see [Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/)

```sh
git clone git@github.com:scttymn/pandora-wrapper.git
cd pandora-wrapper
npm install
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

For development with hot-reload of the injected CSS/JS:

```sh
npm run tauri dev
```

## Customizing the injected CSS

All visual tweaks live in [`src-tauri/src/wrapper.css`](src-tauri/src/wrapper.css). Editing this file triggers a Cargo rebuild on the next `tauri dev` start because it's pulled in via `include_str!`.

## License

[MIT](LICENSE).
