# Issue Matrix

This document maps the known issue backlog into root-cause categories, architectural
responses, and implementation status. The goal is to keep triage focused on causes
instead of treating symptoms in isolation.

## Root-cause groups

### 1. Shell integration and stacking

Issues: `#1`, `#6`, `#10`, `#12`

Observed symptoms:

- Wallpaper appears in Alt+Tab or overview unexpectedly
- Desktop icons disappear behind the wallpaper
- Wallpaper window competes with shell-managed desktop windows
- Wayland sessions hit stacking assertions or inconsistent layering

Root causes:

- Renderer ownership, shell visibility, and window stacking were previously mixed inside
  one module
- Wallpaper placement relied on broad `lower()` behavior instead of targeted desktop
  coexistence rules
- Desktop windows created by DING and similar extensions were not modeled explicitly

Architectural response:

- `PlaybackSession` now owns session identity and handoff boundaries
- `WindowBindingService` binds windows through generation-aware matching
- `StackingPolicy` encapsulates placement and desktop synchronization behavior
- `WindowUtils` recognizes desktop-class windows explicitly

Status:

- Implemented in the current branch
- Live validation of the refactored runtime in a fresh Wayland session still requires
  logout/login because GNOME Shell keeps the old module graph resident after source sync

### 2. Lifecycle orchestration and restart races

Issues: `#5`, `#8`, `#9`, `#18`

Observed symptoms:

- Multiple wallpaper processes survive rapid changes
- Restart storms happen after repeated preference writes
- Old callbacks bind stale windows to new sessions
- Start/stop transitions behave inconsistently under quick toggles

Root causes:

- Start and stop logic used to be spread across the extension entrypoint and wallpaper
  runtime with weak ownership boundaries
- Process lifecycle and window-binding logic had no strong generation guard
- Runtime transitions had no debounce between settings changes

Architectural response:

- `RuntimeController` owns high-level transitions
- `ProcessSupervisor` owns subprocess lifecycle
- `PlaybackSession` carries one session identity at a time
- Restart debounce and generation guards prevent stale transition reuse

Status:

- Implemented in the current branch
- Diagnostics now expose runtime transitions more clearly through structured debug logs

### 3. Policy engine gaps

Issues: `#7`, `#8`, `#18`

Observed symptoms:

- Wallpaper keeps the display awake when not desired
- Battery/fullscreen policy behavior resumes playback unexpectedly
- Polling-heavy logic makes state transitions harder to reason about

Root causes:

- Policy decisions and playback execution were coupled directly
- Auto-pause used coarse polling instead of reacting to shell window changes
- Sleep inhibition behavior was implicit in the player command line
- Desktop/system-managed surfaces could be misread as fullscreen blockers during session
  startup if pause eligibility rules were too broad

Architectural response:

- `AutoPause` now reacts to workspace and window signals
- Resume only happens when the extension itself paused playback
- Sleep inhibition is now explicit via `inhibit-sleep` setting
- Fullscreen pause candidates are filtered through wallpaper/desktop/system-surface
  eligibility rules instead of raw fullscreen-like heuristics

Status:

- Implemented in the current branch
- A future `PolicyEngine` abstraction is still documented in the roadmap for broader
  idle/power policy growth

### 4. Media library and thumbnail pipeline

Issues: `#3`, `#17`

Observed symptoms:

- Imported media overwrites existing files silently
- Thumbnails fail for some codecs or containers
- Gallery health is opaque and difficult to debug

Root causes:

- Media import previously depended on direct file copies without catalog-level ownership
- Thumbnail generation lacked validation and fallback formats
- Gallery UI had no persistent media health model

Architectural response:

- `MediaCatalogService` now owns persistent metadata and conflict-free import naming
- `ThumbnailService` validates outputs and retries with fallback formats and timestamps
- Gallery UI renders item health instead of assuming happy-path thumbnail generation

Status:

- Implemented in the current branch

### 5. Storage and operational reliability

Issues: `#2`, plus manual-install and schema comments hidden inside `#6`

Observed symptoms:

- Manual updates diverge from release installs
- Storage layout assumptions make field debugging harder
- Session reload expectations are unclear for Wayland operators

Root causes:

- Operational docs and scripts did not define the runtime contract sharply enough
- Storage, logs, and validation steps were not surfaced together

Architectural response:

- Release and update scripts were hardened
- Smoke validation and CI artifact checks were added
- Diagnostics now include storage snapshot, current settings, and shell log filters

Status:

- Implemented in the current branch

### 6. Multi-monitor and topology awareness

Issues: `#11`, `#14`

Observed symptoms:

- Stretching, geometry mismatch, or lack of per-monitor control
- Single-session runtime does not match multi-monitor user expectations

Root causes:

- Runtime still models playback as one global session
- Monitor topology is not yet a first-class input to session orchestration

Architectural response:

- Current refactor isolates lifecycle responsibilities so a future monitor-aware session
  layer can be added without rebreaking shell visibility and process ownership

Status:

- Not implemented yet
- Explicitly tracked as the next architectural wave after runtime stabilization

### 7. Rotation and mixed-media experience

Issues: `#15`, `#16`

Observed symptoms:

- Users want mixed static/video libraries and scheduled rotation
- Current runtime treats selection as a single direct setting

Root causes:

- There is no scheduler or playlist abstraction yet
- Runtime selection still points to one chosen file at a time

Architectural response:

- Persistent media catalog now provides the foundation for future rotation policies
- Roadmap documents a feature-layer wave after runtime and media stability

Status:

- Foundation implemented
- Feature itself not implemented yet

## Practical reading of the backlog

The issue list does not describe seven unrelated bugs. It describes one system under
stress in a few predictable places:

- Shell integration
- Lifecycle ownership
- Policy decisions
- Media pipeline reliability
- Operator ergonomics

That framing is what guided the current branch. Fixes were grouped by ownership boundary
instead of by symptom wording, which is why several historical issues move together once
runtime, media, and diagnostics are separated cleanly.
