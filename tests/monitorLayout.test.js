// Run: gjs -m tests/monitorLayout.test.js
import System from "system";
import { layoutMonitors, monitorAt } from "../modules/monitorLayout.js";
import { resolveMonitor } from "../modules/monitorConfig.js";

let failures = 0, passed = 0;
function eq(actual, expected, name) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) passed++;
    else { failures++; print(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`); }
}

const monitors = [
    { connector: "DP-2", x: 0, y: 0, width: 2560, height: 1440 },
    { connector: "DP-3", x: 2560, y: 0, width: 3440, height: 1440 },
];

// 6000x1440 desktop into a 620x200 area with 20px padding:
// scale = min(580/6000, 160/1440) = 0.09667; drawn 580x139.2, centred vertically,
// each monitor inset by gap/2 on every side.
const rects = layoutMonitors(monitors, 620, 200, 20, 4);
eq(rects.map((r) => r.connector), ["DP-2", "DP-3"], "keeps monitor order");
eq(rects.map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]),
    [[22, 32, 243, 135], [269, 32, 329, 135]],
    "scales and centres, with a gap between monitors");
eq(layoutMonitors([], 620, 200, 20, 4), [], "no monitors, no rects");

eq(monitorAt(rects, 100, 100), "DP-2", "click inside first monitor");
eq(monitorAt(rects, 400, 100), "DP-3", "click inside second monitor");
eq(monitorAt(rects, 5, 5), null, "click outside every monitor");

// Mirror mode: every monitor uses the default file, per-monitor scaling still applies.
const config = { "DP-3": { file: "b.mp4", fit: "fit" } };
eq(resolveMonitor(config, "DP-3", "a.mp4", "mirror"),
    { file: "a.mp4", fit: "fit", zoom: 1, alignX: 0, alignY: 0 },
    "mirror ignores per-monitor file but keeps scaling");
eq(resolveMonitor(config, "DP-3", "a.mp4", "unique").file, "b.mp4", "unique uses per-monitor file");
eq(resolveMonitor(config, "DP-3", "a.mp4").file, "b.mp4", "mode defaults to unique behaviour for old callers");

print(`${passed} passed, ${failures} failed`);
if (failures) System.exit(1);
