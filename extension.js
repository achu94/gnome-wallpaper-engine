import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Shell from "gi://Shell";
import Meta from "gi://Meta";

let Cairo;
try {
    Cairo = (await import("gi://cairo")).default;
} catch (e) {
    console.log("Wallpaper Engine: Cairo nicht verfügbar.");
}

import { Indicator } from "./indicator.js";

export default class WallpaperExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine",
        );

        this._settingsSignal = this._settings.connect(
            "changed::current-wallpaper",
            () => {
                if (this._mpvProcess) this.startWallpaper();
            },
        );

        this._mpvProcess = null;
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

            // Verhindert, dass MPV Tastenbefehle annimmt
            "--input-default-bindings=no",
            "--input-vo-keyboard=no",

            // WICHTIG: Diese Zeilen sorgen dafür, dass die Maus bleibt!
            "--cursor-autohide=no", // Verhindert das Verstecken der Maus

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
                let found = this._applyWindowRules();
                attempts++;
                if (!found && attempts < 20) {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, findWindow);
                }
                return GLib.SOURCE_REMOVE;
            };
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, findWindow);
        } catch (e) {
            console.error("Wallpaper Engine Fehler: " + e);
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
                // 1. Desktop-Typ (unterste Ebene)
                metaWin.set_window_type(Meta.WindowType.DESKTOP);

                // 2. FOKUS-VERBOT (Wichtig für Tasten!)
                // Das Fenster kann niemals aktiv werden, egal was man drückt
                metaWin.focus_on_click = false;

                // 3. System-Eigenschaften
                metaWin.set_skip_taskbar(true);
                metaWin.stick();
                metaWin.lower();

                // 4. MAUS-DURCHLASS (Cairo Magic)
                if (Cairo && Cairo.Region) {
                    try {
                        let emptyRegion = new Cairo.Region();
                        metaWin.set_input_region(emptyRegion);
                    } catch (e) {}
                }

                console.log("Wallpaper Engine: Ghost-Modus aktiv.");
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
        if (this._settingsSignal)
            this._settings.disconnect(this._settingsSignal);
        this.stopWallpaper();
        this._indicator.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
