# Observability and Diagnostics

The extension runs inside GNOME Shell and controls an external renderer process. Good
diagnostics are essential for triaging lifecycle and layering bugs.

## Diagnostics script

Use `debug.sh` from repository root.

### Quick status

```bash
./debug.sh status
```

Shows:

- Extension enabled state and version
- Current settings snapshot
- Media storage snapshot (`~/.local/share/gnome-wallpaper-engine`)
- Active `mpv` process list related to the extension
- Detected shell session type

### Journal logs

```bash
./debug.sh logs --since "20 min ago"
```

This filters `journalctl` to GNOME Shell and extension-related signals.
It also includes structured debug output emitted by the runtime controller and playback
pipeline.

### Full capture bundle

```bash
./debug.sh capture --output /tmp/gwe-diagnostics.txt
```

Capture includes:

- Environment information (`uname`, distro, session type)
- Extension metadata and selected settings
- Process snapshot (`ps` for `gnome-shell` and `mpv`)
- Recent GNOME Shell logs

## Recommended issue report content

- Distribution and version
- GNOME Shell version
- Wayland or X11
- Exact extension version from `metadata.json`
- Output from `./debug.sh capture`
- Reproduction steps with expected and actual behavior

## Common signatures and likely causes

- `meta_window_set_stack_position_no_sync`
  Usually indicates window stacking contention with desktop/window-management extensions.
- Multiple `mpv --title=wallpaper_bg` processes
  Often points to lifecycle race or restart storm.
- Missing `mpv` process even when `current-wallpaper` is populated
  Usually indicates early runtime abort, pause policy, or a shell session still running
  a previously loaded extension build.
- Thumbnail entries without preview
  Usually indicates media decode/thumbnail generation failures.

## Operator guidance

- Prefer reproducing on a clean extension set when investigating layering problems.
- Keep diagnostics output attached to each test cycle to avoid ambiguous regressions.
- Always include absolute timestamps when discussing logs.
