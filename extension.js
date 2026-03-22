import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Meta from "gi://Meta";

let Cairo;
try {
    Cairo = (await import("gi://cairo")).default;
} catch (e) {
    console.log("Wallpaper Engine: Cairo not available.");
}

import { Indicator } from "./indicator.js";

export default class WallpaperExtension extends Extension {
    enable() {
        this._mpvExists = GLib.find_program_in_path('mpv');

        if (!this._mpvExists) {
            Main.notify("Gnome Wallpaper Engine", "ERROR: 'mpv' not found!");
            return;
        }

        this._settings = this.getSettings("org.gnome.shell.extensions.gnome-wallpaper-engine");

        this._indicator = null;
        this._mpvProcess = null;
        this._autoStartTimeoutId = null;
        this._findWindowTimeoutId = null;

        this._indicatorSignalId = this._settings.connect(
            "changed::show-indicator",
            () => this._updateIndicatorVisibility()
        );
        this._updateIndicatorVisibility();

        this._settingsSignalId = this._settings.connect(
            "changed::current-wallpaper",
            () => this.startWallpaper()
        );

        this._autoStartTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            if (this._settings.get_boolean("autostart")) {
                this.startWallpaper();
            }
            this._autoStartTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _updateIndicatorVisibility() {
        const show = this._settings.get_boolean("show-indicator");
        if (show && !this._indicator) {
            this._indicator = new Indicator(this);
            Main.panel.addToStatusArea(this.uuid, this._indicator);
        } else if (!show && this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    startWallpaper() {
        this.stopWallpaper();

        const filename = this._settings.get_string("current-wallpaper");
        if (!filename) return;

        const videoPath = GLib.build_filenamev([this.path, "backgrounds", filename]);

        const cmd = [
            "mpv",
            "--no-border",
            "--loop=inf",
            "--no-audio",
            "--geometry=100%x100%",
            "--no-osc",
            "--no-osd-bar",
            "--title=wallpaper_bg",
            "--x11-name=wallpaper_bg",
            "--hwdec=auto",
            videoPath,
        ];

        try {
            this._mpvProcess = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);

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

            this._findWindowTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, findWindow);
        } catch (e) {
            console.error(e);
        }
    }

    _applyWindowRules() {
        const windows = global.get_window_actors();
        for (const actor of windows) {
            const metaWin = actor.get_meta_window();
            if (metaWin && (metaWin.get_title() === "wallpaper_bg" || metaWin.get_wm_class() === "wallpaper_bg")) {
                metaWin.set_window_type(Meta.WindowType.DESKTOP);
                metaWin.make_below();
                metaWin.lower();
                metaWin.focus_on_click = false;
                metaWin.set_skip_taskbar(true);
                metaWin.stick();

                if (Cairo && Cairo.Region) {
                    try {
                        const emptyRegion = new Cairo.Region();
                        metaWin.set_input_region(emptyRegion);
                    } catch (e) { }
                }
                return true;
            }
        }
        return false;
    }

    stopWallpaper() {
        if (this._mpvProcess) {
            this._mpvProcess.force_exit();
            this._mpvProcess = null;
        }
    }

    disable() {
        if (this._autoStartTimeoutId) {
            GLib.source_remove(this._autoStartTimeoutId);
            this._autoStartTimeoutId = null;
        }
        if (this._findWindowTimeoutId) {
            GLib.source_remove(this._findWindowTimeoutId);
            this._findWindowTimeoutId = null;
        }

        if (this._settingsSignalId) {
            this._settings.disconnect(this._settingsSignalId);
            this._settingsSignalId = null;
        }
        if (this._indicatorSignalId) {
            this._settings.disconnect(this._indicatorSignalId);
            this._indicatorSignalId = null;
        }

        this.stopWallpaper();

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }
}