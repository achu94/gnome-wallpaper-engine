import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import GLib from "gi://GLib";

import { Indicator } from "./indicator.js";
import { Wallpaper } from "./modules/wallpaper.js";
import { AutoPause } from "./modules/autoPause.js";

import { debug } from "./modules/utils.js";

export default class WallpaperExtension extends Extension {
    enable() {
        this._mpvExists = GLib.find_program_in_path('mpv');
        this._ffmpegExists = GLib.find_program_in_path('ffmpeg');
        
        let missing = [];
        
        if (!this._mpvExists) {
            missing.push("'mpv'");
        }
        
        if (!this._ffmpegExists) {
            missing.push("'ffmpeg'");
        }
        
        if (missing.length > 0) {
            let msg = "Error: Missing dependencies: " + missing.join(" and ");
            Main.notify("Gnome Live Wallpaper", msg);
            return;
        }
        
        globalThis.debug = debug;

        this._settings = this.getSettings("org.gnome.shell.extensions.gnome-wallpaper-engine");

        this._indicator = null;
        this._wallpaper = new Wallpaper(this);
        
        this._indicatorSignalId = this._settings.connect(
            "changed::show-indicator",
            () => this._updateIndicatorVisibility()
        );
        this._updateIndicatorVisibility();

        this._settingsSignalId = this._settings.connect(
            "changed::current-wallpaper",
            () => this._wallpaper.start()
        );

        this._autoStartTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            if (this._settings.get_boolean("autostart") && this._settings.get_string("current-wallpaper") !== "") {
                this._wallpaper.start();
            }
            return GLib.SOURCE_REMOVE;
        });
        
        this._autoPause = new AutoPause(this, this._wallpaper);
        this._autoPause.start();
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

    disable() {
        if (this._autoStartTimeoutId) {
            GLib.source_remove(this._autoStartTimeoutId);
            this._autoStartTimeoutId = null;
        }

        if (this._settingsSignalId) {
            this._settings.disconnect(this._settingsSignalId);
            this._settingsSignalId = null;
        }

        if (this._indicatorSignalId) {
            this._settings.disconnect(this._indicatorSignalId);
            this._indicatorSignalId = null;
        }

        if (this._wallpaper) {
            this._wallpaper.stop();
            this._wallpaper = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._autoPause) {
            this._autoPause.stop();
            this._autoPause = null;
        }

        this._settings = null;
    }
}