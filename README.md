# GNOME Live Wallpaper Engine

Live wallpapers for GNOME Shell (Wayland and X11) powered by `mpv` and `ffmpeg`.

This project intentionally favors a practical runtime model: spawn a dedicated video
renderer process and integrate it into GNOME shell behavior (visibility, stacking, and
policy controls) so users can manage live wallpapers from standard extension settings.

![demo](https://raw.githubusercontent.com/achu94/gnome-wallpaper-engine/main/assets/demo.gif)

## Features

- Integrated gallery inside extension preferences
- Thumbnail generation and wallpaper import flow
- Hardware decode support through `mpv` (`hwdec=auto`)
- Auto-start and tray indicator controls
- Policy controls for fullscreen and battery scenarios
- Static wallpaper fallback for overview consistency
- GNOME Shell support matrix defined in `metadata.json` (`45` to `49`)

## Dependencies

Runtime dependencies:

- `mpv`
- `ffmpeg`
- GNOME Shell with extension support

Operational dependencies:

- `gnome-extensions` CLI (install/enable/disable commands)
- `glib-compile-schemas` (required for manual install and local dev updates)

Packaging/developer tooling used by this repo:

- `bash`, `zip`, `rsync`, `mktemp`

### Install dependencies

Ubuntu / Debian / Zorin:

```bash
sudo apt update
sudo apt install mpv ffmpeg gnome-shell-extensions
```

Fedora:

```bash
sudo dnf install mpv ffmpeg gnome-extensions-app
```

Arch Linux:

```bash
sudo pacman -S mpv ffmpeg gnome-shell-extensions
```

openSUSE:

```bash
sudo zypper in mpv ffmpeg gnome-extensions
```

## Installation

### Recommended: install release ZIP

```bash
gnome-extensions install gnome-wallpaper-engine@gjs.com.zip
gnome-extensions enable gnome-wallpaper-engine@gjs.com
```

Apply shell reload:

- Wayland: log out and log back in
- X11: `Alt + F2`, type `r`, press `Enter`

### Manual install

1. Extract the release into:
   `~/.local/share/gnome-shell/extensions/gnome-wallpaper-engine@gjs.com`
2. Compile schemas:
   `glib-compile-schemas ~/.local/share/gnome-shell/extensions/gnome-wallpaper-engine@gjs.com/schemas`
3. Enable the extension:
   `gnome-extensions enable gnome-wallpaper-engine@gjs.com`
4. Reload GNOME session (Wayland logout/login, X11 restart shell)

### Local development update

From repository root:

```bash
./update-extension.sh --from-source --enable
```

This path syncs the current checkout into your local extensions directory and compiles
schemas in place.

## Observability and diagnostics

Use the bundled diagnostics command to capture extension state and recent logs:

```bash
./debug.sh capture
```

Useful modes:

- `./debug.sh status` for quick runtime summary
- `./debug.sh logs --since "15 min ago"` for GNOME Shell logs
- `./debug.sh capture --output /tmp/gwe-diagnostics.txt` for bug reports

Full guide: [docs/observability.md](docs/observability.md)

## Architecture and roadmap

Architecture and implementation planning are documented explicitly:

- [docs/architecture-roadmap.md](docs/architecture-roadmap.md)
- [docs/operations.md](docs/operations.md)
- [docs/release-process.md](docs/release-process.md)

Roadmap alignment is tracked by issue clusters:

- Shell visibility and layering: `#1`, `#6`, `#10`, `#12`
- Multi-monitor runtime: `#11`, `#14`
- Lifecycle and policy engine: `#5`, `#7`, `#8`, `#9`, `#18`
- Media reliability and thumbnails: `#3`, `#17`
- Rotation and mixed media: `#15`, `#16`

## Release quality gates

Before publishing a release ZIP:

```bash
./create-release-zip.sh
./scripts/validate-release.sh gnome-wallpaper-engine@gjs.com.zip
```

CI also runs the validation workflow on pushes and pull requests.

## Support

If you want to support development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/achu94)

## License

GPL-3.0.
