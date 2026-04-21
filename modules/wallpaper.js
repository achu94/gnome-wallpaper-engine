import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { WindowUtils } from "./windowUtils.js";
import { StaticWallpaper } from "./staticWallpaper.js";
import { getBackgroundsDir } from "./utils.js";

export class Wallpaper {
    constructor(ext, windowFilter) {
        this._ext = ext;
        this._windowFilter = windowFilter;
        this._staticWallpaper = new StaticWallpaper();

        this._mpvProcesses = [];
        this._findWindowTimeoutId = null;

        this._wallpaperWindows = new Map();
        this._raisedSignalIds = new Map();
        this._windowCreatedId = null;
        this._grabOpEndId = null;
    }

    start() {
        this.stop();

        const settings = this._ext._settings;
        const filename = settings.get_string("current-wallpaper");
        if (!filename) return;

        const bgDir = getBackgroundsDir();
        const videoPath = GLib.build_filenamev([bgDir, filename]);

        const baseName = filename.substring(0, filename.lastIndexOf("."));
        const thumbPath = GLib.build_filenamev([
            bgDir,
            `${baseName}-thumb.webp`,
        ]);

        this._staticWallpaper.set(thumbPath);

        const nMonitors = global.display.get_n_monitors();

        // Snap wallpaper windows back if user tries to move/resize them
        this._grabOpEndId = global.display.connect(
            "grab-op-end",
            (display, window) => {
                for (const [monitorIndex, win] of this._wallpaperWindows) {
                    if (win === window) {
                        const monitor =
                            global.display.get_monitor_geometry(monitorIndex);
                        win.move_resize_frame(
                            true,
                            monitor.x,
                            monitor.y,
                            monitor.width,
                            monitor.height,
                        );
                        win.lower();
                        break;
                    }
                }
            },
        );

        // Connect window-created before spawning so we catch windows immediately
        this._windowCreatedId = global.display.connect(
            "window-created",
            (_, metaWin) => {
                // Lower existing wallpaper windows whenever any new window appears
                for (const [, win] of this._wallpaperWindows) {
                    try {
                        win.lower();
                    } catch (_) {}
                }
                // Try to claim this new window as a wallpaper window
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this._tryClaim(metaWin);
                    return GLib.SOURCE_REMOVE;
                });
            },
        );

        for (let i = 0; i < nMonitors; i++) {
            const title = `wallpaper_bg_${i}`;
            const monitor = global.display.get_monitor_geometry(i);

            const cmd = [
                "mpv",
                "--no-border",
                "--loop=inf",
                "--no-audio",
                "--force-window=yes",
                "--ontop=no",
                "--keep-open=yes",
                "--no-osc",
                "--no-osd-bar",
                `--title=${title}`,
                `--geometry=${monitor.width}x${monitor.height}`,
                "--panscan=1.0",
                "--video-unscaled=no",
                "--input-default-bindings=no",
                "--input-vo-keyboard=no",
                "--cursor-autohide=no",
                "--hwdec=auto",
                videoPath,
            ];

            try {
                const process = Gio.Subprocess.new(
                    cmd,
                    Gio.SubprocessFlags.NONE,
                );
                this._mpvProcesses.push(process);
            } catch (e) {
                logError(e);
            }
        }

        // Polling fallback for windows whose titles are set slightly late
        let attempts = 0;
        const findWindow = () => {
            if (this._mpvProcesses.length === 0) {
                this._findWindowTimeoutId = null;
                return GLib.SOURCE_REMOVE;
            }

            for (const actor of global.get_window_actors()) {
                this._tryClaim(actor.get_meta_window());
            }

            attempts++;

            if (this._wallpaperWindows.size >= nMonitors || attempts >= 50) {
                this._findWindowTimeoutId = null;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        };

        this._findWindowTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            200,
            findWindow,
        );
    }

    _tryClaim(metaWin) {
        if (!metaWin) return;
        if (!WindowUtils.isWallpaperWindow(metaWin)) return;

        const title = metaWin.get_title() ?? "";
        const match = title.match(/wallpaper_bg_(\d+)/);
        if (!match) return;

        const monitorIndex = parseInt(match[1]);
        if (this._wallpaperWindows.has(monitorIndex)) return;

        const monitor = global.display.get_monitor_geometry(monitorIndex);

        const applyGeometry = (win) => {
            win.move_to_monitor(monitorIndex);
            // user_op=true bypasses Mutter's placement constraints so we hit exact coords
            win.move_resize_frame(
                true,
                monitor.x,
                monitor.y,
                monitor.width,
                monitor.height,
            );
            win.lower();
        };

        applyGeometry(metaWin);
        metaWin.stick();
        metaWin.focus_on_click = false;

        try {
            metaWin.set_accept_focus(false);
        } catch (_) {}

        // Re-apply geometry several times to fight GNOME Shell's initial placement passes
        let count = 0;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            if (!metaWin) return GLib.SOURCE_REMOVE;
            applyGeometry(metaWin);
            count++;
            return count < 10 ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE;
        });

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            try {
                metaWin.set_input_region(null);
            } catch (_) {}
            return GLib.SOURCE_REMOVE;
        });

        this._wallpaperWindows.set(monitorIndex, metaWin);

        if (this._windowFilter) {
            this._windowFilter.addWindow(metaWin);
        }

        const raisedId = metaWin.connect("raised", () =>
            applyGeometry(metaWin),
        );
        this._raisedSignalIds.set(monitorIndex, raisedId);
    }

    stop() {
        if (this._findWindowTimeoutId) {
            GLib.source_remove(this._findWindowTimeoutId);
            this._findWindowTimeoutId = null;
        }

        for (const process of this._mpvProcesses) {
            try {
                process.force_exit();
            } catch (_) {}
        }
        this._mpvProcesses = [];

        for (const [monitorIndex, signalId] of this._raisedSignalIds) {
            const win = this._wallpaperWindows.get(monitorIndex);
            if (win) {
                try {
                    win.disconnect(signalId);
                } catch (_) {}
            }
        }
        this._raisedSignalIds.clear();

        if (this._grabOpEndId) {
            global.display.disconnect(this._grabOpEndId);
            this._grabOpEndId = null;
        }

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        this._wallpaperWindows.clear();
    }

    monitors() {
        const display = global.display;
        const n = display.get_n_monitors();

        const list = [];

        for (let i = 0; i < n; i++) {
            const g = display.get_monitor_geometry(i);

            list.push({
                x: g.x,
                y: g.y,
                width: g.width,
                height: g.height,
            });
        }

        return list;
    }
}
