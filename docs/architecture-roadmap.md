# Architecture Roadmap

## Goal

Evolve the extension from a tightly coupled runtime into a composable architecture that
supports stable playback, desktop coexistence, policy controls, and multi-monitor support
without continuously increasing complexity inside `modules/wallpaper.js`.

## Current architecture snapshot

The current implementation has a clear "working core", but responsibilities are mixed:

- `extension.js` orchestrates dependencies, module startup, and settings bindings.
- `modules/wallpaper.js` handles process spawn, window discovery, stacking policy, and
  static fallback side effects.
- `modules/windowFilter.js` monkeypatches GNOME shell APIs to hide wallpaper windows.
- `modules/autoPause.js` applies fullscreen and battery policies via periodic checks.

This design works in practice, but issue history shows pressure on layering, lifecycle
races, and cross-version shell compatibility.

## Issue clusters

- Shell visibility, stacking, and overview behavior: `#1`, `#6`, `#10`, `#12`
- Multi-monitor rendering and geometry: `#11`, `#14`
- Lifecycle and power policy: `#5`, `#7`, `#8`, `#9`, `#18`
- Thumbnail/gallery reliability: `#3`, `#17`
- Mixed media and rotation: `#15`, `#16`

## Target architecture

- `RuntimeController`
  Coordinates startup/shutdown and is the single owner of runtime transitions.
- `PlaybackSession`
  Represents one active wallpaper session (media, subprocess, bound window, run ID).
- `ProcessSupervisor`
  Handles spawn, termination, and lifecycle guarantees for renderer processes.
- `WindowBindingService`
  Binds shell windows to owned processes and prevents stale callback reuse.
- `StackingPolicy`
  Applies desktop coexistence rules without broad event-driven lowering loops.
- `ShellVisibilityAdapter`
  Contains shell patch points and version guards in one dedicated module.
- `PolicyEngine`
  Computes desired playback state from fullscreen, battery, idle, and sleep context.
- `MediaLibraryService`
  Owns import, indexing, conflict handling, and metadata storage.
- `ThumbnailService`
  Owns thumbnail queue, validation, retry, and output format fallback.

## Implementation waves

### P0: stabilization

- Debounce restart storms from rapid settings writes.
- Bind wallpaper windows by PID and title/class to reduce false matches.
- Ignore stale callbacks by run generation guards.
- Prevent `AutoPause` from resuming sessions it did not pause.
- Document architecture, operations, and diagnostics.

### P1: lifecycle hardening

- Introduce explicit session states (`IDLE`, `STARTING`, `RUNNING`, `STOPPING`, `PAUSED`).
- Replace fan-out `start()/stop()` calls with controller-level `setDesiredState(...)`.
- Add structured lifecycle diagnostics for process/window transitions.

### P2: media pipeline

- Move heavy gallery operations out of prefs UI path.
- Add persistent media catalog with stable IDs and conflict policy.
- Add thumbnail validation and fallback outputs for codec variability.

### P3: policy engine

- Prefer event-driven sources over tight polling loops where GNOME APIs allow.
- Separate policy decisions from playback execution.
- Add explicit policies for fullscreen, battery, idle, and sleep inhibition.

### P4: multi-monitor runtime

- Move from global single session to monitor-aware sessions.
- Handle topology updates (attach/detach/reconfigure) safely.
- Resolve stretch/fill concerns with per-monitor constraints.

### P5: feature layer

- First-class static image support in gallery and runtime.
- Rotation and scheduling over mixed media sources.
- Evaluate optional overview-native backend only with compatibility guardrails.

## Definition of done per wave

- Runtime behavior covered by deterministic smoke/validation scripts.
- Release artifact validation passes locally and in CI.
- Issue references linked in PR descriptions and changelog notes.
- Diagnostics output includes enough context for reproducible bug reports.

## Maintainer notes

- Consider splitting `#6` into focused issues (overview mode, manual install/schema path,
  multi-monitor comments, thumbnail failures) to improve triage.
- Treat `#9` and `#12` as architecture-sensitive issues and require regression checks
  before release tagging.
