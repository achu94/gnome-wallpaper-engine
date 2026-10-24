import Cairo from "cairo";
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
        this._mpvProcess = null;
        this._findWindowTimeoutId = null;
        this._wallpaperWindow = null;
        this._raisedSignalId = null;
        this._windowCreatedId = null;
        this._lowerFixApplied = false;
    }

    start() {
        this.stop();

        const settings = this._ext._settings;
        const filename = settings.get_string("current-wallpaper");
        if (!filename) return;

        const bgDir = getBackgroundsDir();
        const videoPath = GLib.build_filenamev([bgDir, filename]);
        const baseName = filename.substring(0, filename.lastIndexOf("."));
        const thumbPath = GLib.build_filenamev([bgDir, `${baseName}-thumb.jpg`]);
        this._staticWallpaper.set(thumbPath);

        const command = [
            "mpv",
            "--no-border",
            "--loop=inf",
            "--no-audio",
            "--force-window=yes",
            "--ontop=no",
            "--keep-open=yes",
            "--geometry=100%x100%",
            "--no-osc",
            "--no-osd-bar",
            "--title=wallpaper_bg",
            "--x11-name=wallpaper_bg",
            "--panscan=1.0",
            "--video-unscaled=no",
            "--input-default-bindings=no",
            "--input-vo-keyboard=no",
            "--cursor-autohide=no",
            "--hwdec=auto",
            videoPath,
        ];

        try {
            this._mpvProcess = Gio.Subprocess.new(command, Gio.SubprocessFlags.NONE);
            let attempts = 0;

            const findWindow = () => {
                if (!this._mpvProcess) {
                    this._findWindowTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                const found = this._applyWindowRules();
                attempts++;
                if (found || attempts >= 40) {
                    this._findWindowTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            };

            this._findWindowTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                150,
                findWindow
            );
        } catch (error) {
            logError(error);
        }
    }

    _applyWindowRules() {
        for (const actor of global.get_window_actors()) {
            const metaWindow = actor.get_meta_window();
            if (!WindowUtils.isWallpaperWindow(metaWindow)) continue;

            metaWindow.lower();
            metaWindow.stick();
            metaWindow.focus_on_click = false;

            try {
                metaWindow.set_accept_focus(false);
            } catch (_) { }

            if (!this._lowerFixApplied) {
                this._lowerFixApplied = true;
                let count = 0;
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    if (metaWindow) metaWindow.lower();
                    count++;
                    return count < 5;
                });
            }

            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                try {
                    metaWindow.set_input_region(new Cairo.Region());
                } catch (_) { }
                return GLib.SOURCE_REMOVE;
            });

            if (!this._wallpaperWindow) {
                this._wallpaperWindow = metaWindow;
                this._windowFilter?.addWindow(metaWindow);
                this._raisedSignalId = metaWindow.connect("raised", () => metaWindow.lower());
                // DING also lowers itself on click and ends up under mpv; keep mpv at the very bottom
                this._restackedId = global.display.connect("restacked", () => this._wallpaperWindow?.lower());
                this._windowCreatedId = global.display.connect("window-created", () => {
                    if (this._wallpaperWindow) this._wallpaperWindow.lower();
                });
            }

            return true;
        }

        return false;
    }

    stop() {
        if (this._findWindowTimeoutId) {
            GLib.source_remove(this._findWindowTimeoutId);
            this._findWindowTimeoutId = null;
        }

        if (this._mpvProcess) {
            this._mpvProcess.force_exit();
            this._mpvProcess = null;
        }

        this._lowerFixApplied = false;
        if (this._raisedSignalId && this._wallpaperWindow) {
            this._wallpaperWindow.disconnect(this._raisedSignalId);
            this._raisedSignalId = null;
        }
        if (this._restackedId) {
            global.display.disconnect(this._restackedId);
            this._restackedId = null;
        }
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }
        if (this._wallpaperWindow) {
            this._windowFilter?.removeWindow(this._wallpaperWindow);
            this._wallpaperWindow = null;
        }
    }

    destroy() {
        this.stop();
    }
}