// Run: gjs -m tests/monitorConfig.test.js
import System from "system";
import {
    FIT_MODES,
    parseMonitorConfig,
    resolveMonitor,
    updateMonitor,
    buildScalingArgs,
    filterVideoFiles,
} from "../modules/monitorConfig.js";

let failures = 0;
let passed = 0;

function eq(actual, expected, name) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        passed++;
    } else {
        failures++;
        print(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`);
    }
}

// parseMonitorConfig
eq(parseMonitorConfig(""), {}, "empty string parses to {}");
eq(parseMonitorConfig("not json"), {}, "invalid json parses to {}");
eq(parseMonitorConfig("[1,2]"), {}, "non-object json parses to {}");
eq(parseMonitorConfig('{"DP-2":{"fit":"fit"}}'), { "DP-2": { fit: "fit" } }, "valid json parses");

// resolveMonitor
eq(resolveMonitor({}, "DP-3", "a.mp4"),
    { file: "a.mp4", fit: "fill", zoom: 1, alignX: 0, alignY: 0 },
    "unknown monitor gets defaults and the default file");
eq(resolveMonitor({ "DP-3": { file: "b.mp4", fit: "fit", zoom: 1.5, alignX: -1 } }, "DP-3", "a.mp4"),
    { file: "b.mp4", fit: "fit", zoom: 1.5, alignX: -1, alignY: 0 },
    "monitor settings override defaults");
eq(resolveMonitor({ "DP-3": { file: "" } }, "DP-3", "a.mp4").file, "a.mp4",
    "empty per-monitor file falls back to default");
eq(resolveMonitor({ "DP-3": { fit: "bogus", zoom: 99, alignX: -7, alignY: "x" } }, "DP-3", ""),
    { file: "", fit: "fill", zoom: 4, alignX: -1, alignY: 0 },
    "bad values are clamped or replaced");

// updateMonitor is immutable
const before = { "DP-2": { fit: "fit" } };
const after = updateMonitor(before, "DP-2", { zoom: 2 });
eq(before, { "DP-2": { fit: "fit" } }, "updateMonitor does not mutate input");
eq(after, { "DP-2": { fit: "fit", zoom: 2 } }, "updateMonitor merges patch");
eq(updateMonitor({}, "DP-3", { file: "x.mp4" }), { "DP-3": { file: "x.mp4" } }, "updateMonitor adds new monitor");

// buildScalingArgs
const base = { file: "a.mp4", zoom: 1, alignX: 0, alignY: 0 };
eq(FIT_MODES, ["fill", "fit", "stretch", "center"], "fit modes");
eq(buildScalingArgs({ ...base, fit: "fill" }),
    ["--keepaspect=yes", "--panscan=1", "--video-unscaled=no", "--video-zoom=0", "--video-align-x=0", "--video-align-y=0"],
    "fill crops to cover");
eq(buildScalingArgs({ ...base, fit: "fit" }),
    ["--keepaspect=yes", "--panscan=0", "--video-unscaled=no", "--video-zoom=0", "--video-align-x=0", "--video-align-y=0"],
    "fit letterboxes");
eq(buildScalingArgs({ ...base, fit: "stretch" }),
    ["--keepaspect=no", "--panscan=0", "--video-unscaled=no", "--video-zoom=0", "--video-align-x=0", "--video-align-y=0"],
    "stretch ignores aspect");
eq(buildScalingArgs({ ...base, fit: "center" }),
    ["--keepaspect=yes", "--panscan=0", "--video-unscaled=yes", "--video-zoom=0", "--video-align-x=0", "--video-align-y=0"],
    "center shows original size");
eq(buildScalingArgs({ ...base, fit: "fill", zoom: 2, alignX: -1, alignY: 0.5 }).slice(3),
    ["--video-zoom=1", "--video-align-x=-1", "--video-align-y=0.5"],
    "zoom is passed as log2, align as-is");

// filterVideoFiles
eq(filterVideoFiles(["a.MP4", "b-thumb.jpg", "c.webm", "notes.txt", ".hidden.mp4", "d.gif"]),
    ["a.MP4", "c.webm", "d.gif"],
    "folder import keeps only supported, non-hidden videos");

print(`${passed} passed, ${failures} failed`);
if (failures) System.exit(1);
