import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import Clutter from "gi://Clutter";

import { WindowUtils } from "./windowUtils.js";
import { debug } from "./utils.js";

export class Wallpaper {
    constructor(ext) {
        this._ext = ext;

        this._mpvProcess = null;
        this._findWindowTimeoutId = null;

        this._wallpaperWindow = null;
        this._raisedSignalId = null;
        this._windowCreatedId = null;
        this._lowerFixApplied = false;
    }

    clone(actor) {
        try {
            const clutterClone = new Clutter.Clone({
                source: actor,
            });

            debug("1: cloned");

            // 👉 FULLSCREEN
            let [width, height] = global.display.get_size();
            clutterClone.set_position(0, 0);
            clutterClone.set_size(width, height);

            debug("2: fullscreen");

            // 👉 IN BACKGROUND (WICHTIG!)
            Main.layoutManager._backgroundGroup.add_child(clutterClone);
            debug("3: in background");

            // 👉 echtes Fenster verstecken
            actor.opacity = 0;

            debug("4: main mpv hidden");

            return clutterClone;
        } catch (error) {
            debug(error);
        }
    }

    start() {
        this.stop();

        const settings = this._ext._settings;
        const filename = settings.get_string("current-wallpaper");
        if (!filename) return;

        const videoPath = GLib.build_filenamev([
            this._ext.path,
            "backgrounds",
            filename,
        ]);

        const cmd = [
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
            this._mpvProcess = Gio.Subprocess.new(
                cmd,
                Gio.SubprocessFlags.NONE,
            );

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
                findWindow,
            );
        } catch (e) {
            logError(e);
        }
    }

    _applyWindowRules() {
        const windows = global.get_window_actors();

        for (const actor of windows) {
            const metaWin = actor.get_meta_window();

            if (WindowUtils.isWallpaperWindow(metaWin)) {
                this.clone(actor);
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    return GLib.SOURCE_REMOVE;
                });

                return;

                metaWin.lower();
                metaWin.stick();
                metaWin.focus_on_click = false;

                try {
                    metaWin.set_accept_focus(false);
                } catch (_) {}

                if (!this._lowerFixApplied) {
                    this._lowerFixApplied = true;

                    let count = 0;
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                        if (metaWin) metaWin.lower();
                        count++;
                        return count < 5;
                    });
                }

                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    try {
                        metaWin.set_input_region(null);
                    } catch (_) {}
                    return GLib.SOURCE_REMOVE;
                });

                if (!this._wallpaperWindow) {
                    this._wallpaperWindow = metaWin;

                    this._raisedSignalId = metaWin.connect("raised", () => {
                        metaWin.lower();
                    });

                    this._windowCreatedId = global.display.connect(
                        "window-created",
                        () => {
                            if (this._wallpaperWindow) {
                                this._wallpaperWindow.lower();
                            }
                        },
                    );
                }

                return true;
            }
        }

        return false;
    }

    stop() {
        if (this._mpvProcess) {
            this._mpvProcess.force_exit();
            this._mpvProcess = null;
        }

        this._lowerFixApplied = false;

        if (this._raisedSignalId && this._wallpaperWindow) {
            this._wallpaperWindow.disconnect(this._raisedSignalId);
            this._raisedSignalId = null;
        }

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        this._wallpaperWindow = null;
    }
}
