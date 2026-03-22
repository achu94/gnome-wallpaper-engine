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
            Main.notify(
                "Gnome Wallpaper Engine",
                "ERROR: 'mpv' is not installed! Please install it via your terminal."
            );
            return;
        }

        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine",
        );

        this._settingsSignal = this._settings.connect(
            "changed::current-wallpaper",
            () => {
                // Restart wallpaper when setting changes
                this.startWallpaper();
            },
        );

        this._mpvProcess = null;
        this._autoStartTimeout = null;

        // Delay initial start slightly to ensure GNOME Shell is ready
        this._autoStartTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            // Wir lesen den Boolean-Wert aus den Settings
            let shouldAutostart = this._settings.get_boolean("autostart");

            if (shouldAutostart) {
                console.log("Wallpaper Engine: Autostart is enabled. Launching...");
                this.startWallpaper();
            } else {
                console.log("Wallpaper Engine: Autostart is disabled by user.");
            }

            this._autoStartTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    startWallpaper() {
        this.stopWallpaper();

        let filename = this._settings.get_string("current-wallpaper");
        if (!filename) return;

        let videoPath = GLib.build_filenamev([
            this.path,
            "backgrounds",
            filename,
        ]);

        let cmd = [
            "mpv",
            "--no-border",
            "--loop=inf",
            "--no-audio",
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
            this._mpvProcess = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);

            // Instead of one fixed delay, we check every 200ms if the window exists
            let attempts = 0;
            const findWindow = () => {
                if (!this._mpvProcess) return GLib.SOURCE_REMOVE;

                let found = this._applyWindowRules();
                attempts++;

                if (found) {
                    console.log("Wallpaper Engine: Window found and rules applied.");
                    return GLib.SOURCE_REMOVE;
                }

                if (attempts >= 30) { // Stop after ~6 seconds
                    console.log("Wallpaper Engine: Search timeout.");
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE; // Try again in 200ms
            };

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, findWindow);
        } catch (e) {
            console.error("Wallpaper Engine Error: " + e);
        }
    }

    _applyWindowRules() {
        let windows = global.get_window_actors();
        for (let actor of windows) {
            let metaWin = actor.get_meta_window();

            if (
                metaWin &&
                (metaWin.get_title() === "wallpaper_bg" ||
                    metaWin.get_wm_class() === "wallpaper_bg")
            ) {
                metaWin.set_window_type(Meta.WindowType.DESKTOP);
                metaWin.focus_on_click = false;
                metaWin.set_skip_taskbar(true);
                metaWin.stick();
                metaWin.lower();

                if (Cairo && Cairo.Region) {
                    try {
                        let emptyRegion = new Cairo.Region();
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
        if (this._autoStartTimeout) {
            GLib.source_remove(this._autoStartTimeout);
            this._autoStartTimeout = null;
        }

        if (this._settingsSignal)
            this._settings.disconnect(this._settingsSignal);

        this.stopWallpaper();

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }
}