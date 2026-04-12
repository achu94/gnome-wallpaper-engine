# Operations Guide

This guide describes day-to-day operations for installing, updating, and validating the
extension in development and user environments.

## Runtime dependencies

- `mpv`
- `ffmpeg`
- GNOME Shell extension runtime

## Operator tooling dependencies

- `gnome-extensions`
- `glib-compile-schemas`
- `bash`, `zip`, `rsync` (for packaging scripts)

## Install from release ZIP

```bash
gnome-extensions install gnome-wallpaper-engine@gjs.com.zip
gnome-extensions enable gnome-wallpaper-engine@gjs.com
```

Session reload:

- Wayland: logout/login
- X11: `Alt + F2`, `r`, `Enter`

## Update local extension from source checkout

```bash
./update-extension.sh --from-source --enable
```

What this does:

- Syncs current repository into local GNOME extension directory
- Compiles schemas in target extension directory
- Optionally enables extension

Wayland note:

- A source sync updates files immediately, but GNOME Shell may continue executing the
  previously loaded module graph until the next logout/login. Treat source sync as
  install parity, not as a guaranteed in-process hot reload.

## Build release ZIP

```bash
./create-release-zip.sh
```

Generated file:

- `gnome-wallpaper-engine@gjs.com.zip`

## Validate release ZIP

```bash
./scripts/validate-release.sh gnome-wallpaper-engine@gjs.com.zip
```

Validation checks:

- ZIP contains expected extension root
- Mandatory files are present (`metadata.json`, `extension.js`, schemas)
- Development-only files are excluded (`.git`, `.github`, local scripts)

## Fast smoke checks

```bash
./scripts/smoke-check.sh
```

Smoke checks include:

- Script syntax checks (`bash -n`)
- Schema compilation in temporary staging directory
- Release packaging + release validation

## Recommended incident workflow

1. Reproduce with latest local source using `update-extension.sh --from-source`.
2. Capture diagnostics via `./debug.sh capture`.
3. Attach diagnostics output and GNOME version details to issue/PR discussion.
