# Pandora Wrapper

<img width="1213" height="965" alt="Screenshot 2026-04-30 at 6 24 32 PM" src="docs/screenshot.webp" />

An unofficial desktop wrapper around [pandora.com](https://www.pandora.com) built with [Tauri](https://tauri.app). Runs Pandora's web player as a native-feeling app on macOS, Windows, and Linux.

> **Disclaimer:** This is an independent, unaffiliated project. It is not endorsed by, sponsored by, or otherwise associated with Pandora Media, LLC. "Pandora" and the Pandora logo are trademarks of Pandora Media, LLC; this project uses them solely to indicate compatibility. Pandora's service is currently only available in the United States and select other countries — this wrapper does not change that geo-restriction.

## Features

- Native window chrome on macOS (transparent title bar, traffic lights overlaid on Pandora's nav).
- Custom CSS injected to clean up the chrome (hidden scrollbars, top bar layout adjustments, splash screen suppressed).
- Conditional in-app back button that only appears on non-top-level routes.
- Keyboard shortcuts for playback and feedback (see below).
- Drag the window from the top nav region (everywhere except interactive elements).
- No telemetry. No bundled tracking. The app is just a window pointed at `https://www.pandora.com/`.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Media Play/Pause (`F8`) | Play / pause the current track |
| Media Next (`F9`) | Skip to the next track |
| Media Previous (`F7`) | Restart the current track (Pandora's "Replay") |
| `↑` | Thumbs up |
| `↓` | Thumbs down |

Arrow shortcuts are ignored while typing in inputs or with modifier keys held.

## Build from source

No pre-built binaries are distributed — build it yourself.

You'll need:

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) 18+
- Platform-specific build prerequisites — see [Tauri's prerequisites guide](https://v2.tauri.app/start/prerequisites/)

```sh
git clone https://git.svnmns.com/scttymn/pandora-wrapper.git
cd pandora-wrapper
npm install
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/` — `.dmg` on macOS, `.deb`/`.AppImage` on Linux.

For development with hot-reload of the injected CSS/JS:

```sh
npm run tauri dev
```

### macOS first launch

Locally-built apps are unsigned, so macOS Gatekeeper will block them on first launch — typically with a "Pandora.app is damaged and can't be opened" message. After installing the `.dmg`, run:

```sh
xattr -cr /Applications/Pandora.app
```

This clears the quarantine attributes. If you still see the "damaged" error after that (rare on recent macOS), ad-hoc sign the bundle locally:

```sh
codesign --force --deep --sign - /Applications/Pandora.app
```

## Customizing the injected CSS

All visual tweaks live in [`src-tauri/src/wrapper.css`](src-tauri/src/wrapper.css). Editing this file triggers a Cargo rebuild on the next `tauri dev` start because it's pulled in via `include_str!`.

## License

[MIT](LICENSE).
