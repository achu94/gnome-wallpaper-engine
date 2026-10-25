# Contributing to GNOME Live Wallpaper

Thanks for your interest in contributing! Bug reports, ideas and pull requests are all welcome.

## Reporting bugs

Please open an issue using the **Bug report** template.

## Development setup

Requirements: **mpv** and **ffmpeg** (see the README for install commands per distribution).

```bash
git clone https://github.com/achu94/gnome-wallpaper-engine.git
cd gnome-wallpaper-engine
```

### Install your local changes

```bash
./update-extension.sh
```

This builds the release ZIP (`create-release-zip.sh`), installs it with `gnome-extensions install --force`
and **logs you out** so GNOME Shell picks up the new code. Save your work before running it.

### Test in a nested GNOME Shell (no logout needed)

```bash
./debug.sh
```

This starts a nested GNOME Shell session and shows the extension's log output.
On GNOME 49 and newer, `gnome-shell --nested` was replaced by `gnome-shell --devkit`.

### Supported GNOME versions

The extension supports GNOME Shell **45–51** (see `shell-version` in `metadata.json`).
Multi-monitor support requires GNOME 50 or newer.

If your change touches version-specific APIs, please mention which versions you tested.
To test older versions, a VM (e.g. GNOME Boxes with Debian 13 or Ubuntu 24.04) works well.

## Pull requests

- Keep PRs focused on one change. Small PRs are reviewed and merged faster.
- Describe the problem and your fix in the PR description.
- Mention the GNOME version and session type (Wayland/X11) you tested on.
- Follow the existing code style and project structure (`modules/`, `prefs/`, `schemas/`).
- If you change GSettings schemas, make sure they still compile:

  ```bash
  glib-compile-schemas --strict --dry-run schemas/
  ```

- Please don't leave unused code behind. If your change makes a helper obsolete, feel free to remove it.

## AI-assisted contributions

AI tools are welcome. Every PR is reviewed and tested by the maintainer before it is merged.

Please make sure that:

- you understand the code you submit and can explain it if asked,
- you have tested your changes yourself,
- the code uses real GNOME Shell / Mutter APIs and contains no unnecessary boilerplate.

The extension is published on [extensions.gnome.org](https://extensions.gnome.org/extension/9558/gnome-wallpaper-engine/),
so all code must meet the
[GNOME Shell extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).

If you like, you can mention AI usage with an `Assisted-by:` trailer in your commit message (optional).
Please **don't** add AI tools as co-authors (`Co-authored-by:`), so that only people are listed as contributors.

If your AI tool adds a `Co-authored-by` trailer automatically, please remove it or turn it off in the tool's settings.

## License

This project is licensed under **GPL-3.0**. By contributing, you agree that your contributions
are licensed under the same license.
