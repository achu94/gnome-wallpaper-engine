# Release Process

This process defines how to produce and validate release artifacts safely.

## Preconditions

- Working tree is reviewed and ready.
- Schema changes are committed when applicable.
- Dependency tools are available (`bash`, `zip`, `rsync`, `glib-compile-schemas`).

## 1. Build release artifact

```bash
./create-release-zip.sh
```

The script creates:

- `gnome-wallpaper-engine@gjs.com.zip`

The release payload is staged under the extension UUID and schemas are compiled before ZIP
creation.

## 2. Validate artifact

```bash
./scripts/validate-release.sh gnome-wallpaper-engine@gjs.com.zip
```

The validator checks:

- Mandatory files and schema assets exist
- Archive is rooted under extension UUID folder
- Development-only files are excluded from package

## 3. Run repository smoke checks

```bash
./scripts/smoke-check.sh
```

This covers syntax checks, schema compilation, packaging, and artifact validation.

## 4. Manual sanity install (recommended)

```bash
gnome-extensions install --force gnome-wallpaper-engine@gjs.com.zip
gnome-extensions enable gnome-wallpaper-engine@gjs.com
```

Reload session:

- Wayland: logout/login
- X11: shell restart (`Alt + F2`, `r`, `Enter`)

## 5. Publish

- Attach generated ZIP to GitHub release.
- Include issue references and compatibility notes in release description.
- Mention any known behavior differences between Wayland and X11.

## CI gates

The workflow at `.github/workflows/validation.yml` enforces smoke checks and artifact
validation on pushes and pull requests.
