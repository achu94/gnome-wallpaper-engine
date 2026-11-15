// Per-monitor wallpaper settings, shared by the shell side and prefs.
// Pure JS (no GNOME imports) so it can be unit-tested with plain gjs.
//
// Stored in the "monitor-config" GSettings key as JSON, keyed by connector:
//   {"DP-3": {"file": "a.mp4", "fit": "fill", "zoom": 1.0, "alignX": 0, "alignY": 0}}

export const FIT_MODES = ["fill", "fit", "stretch", "center"];

export const FIT_LABELS = {
    fill: "Fill (crop to cover)",
    fit: "Fit (letterbox)",
    stretch: "Stretch",
    center: "Center (original size)",
};

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

export const VIDEO_EXTENSIONS = [".mp4", ".webm", ".gif", ".mkv", ".mov", ".avi"];

const DEFAULTS = { file: "", fit: "fill", zoom: 1, alignX: 0, alignY: 0 };

function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (typeof value !== "number" || !Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

export function parseMonitorConfig(json) {
    try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (_) {
        // fall through
    }
    return {};
}

export const MODES = ["mirror", "unique"];

// Full, validated settings for one monitor. An unset or empty file means
// "use the default wallpaper" (the current-wallpaper key). In "mirror" mode
// every monitor shows the default wallpaper; scaling stays per monitor.
export function resolveMonitor(config, connector, defaultFile, mode = "unique") {
    const raw = config?.[connector] ?? {};
    const ownFile = mode !== "mirror" && typeof raw.file === "string" && raw.file !== "";
    return {
        file: ownFile ? raw.file : defaultFile,
        fit: FIT_MODES.includes(raw.fit) ? raw.fit : DEFAULTS.fit,
        zoom: clamp(raw.zoom, ZOOM_MIN, ZOOM_MAX, DEFAULTS.zoom),
        alignX: clamp(raw.alignX, -1, 1, DEFAULTS.alignX),
        alignY: clamp(raw.alignY, -1, 1, DEFAULTS.alignY),
    };
}

export function updateMonitor(config, connector, patch) {
    return { ...config, [connector]: { ...(config[connector] ?? {}), ...patch } };
}

// mpv options for a monitor's scaling. alignX/Y pick which part of the video
// shows when it is larger than the screen (cropped by Fill, or zoomed in):
// -1 = left/top edge, 0 = centre, 1 = right/bottom edge.
export function buildScalingArgs({ fit, zoom, alignX, alignY }) {
    return [
        `--keepaspect=${fit === "stretch" ? "no" : "yes"}`,
        `--panscan=${fit === "fill" ? 1 : 0}`,
        `--video-unscaled=${fit === "center" ? "yes" : "no"}`,
        `--video-zoom=${Math.log2(zoom)}`, // mpv takes zoom as log2
        `--video-align-x=${alignX}`,
        `--video-align-y=${alignY}`,
    ];
}

export function isVideoFile(name) {
    const lower = name.toLowerCase();
    return !name.startsWith(".") && VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function filterVideoFiles(names) {
    return names.filter(isVideoFile);
}

// Config with every monitor that showed `file` reset to the default wallpaper.
export function forgetFile(config, file) {
    return Object.fromEntries(Object.entries(config).map(([connector, monitor]) =>
        [connector, monitor?.file === file ? { ...monitor, file: "" } : monitor]));
}
