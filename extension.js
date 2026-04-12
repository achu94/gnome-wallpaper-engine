import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import GLib from "gi://GLib";

import { debug } from "./modules/utils.js";
import { RuntimeController } from "./modules/runtime/runtimeController.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

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

        this._runtimeController = new RuntimeController(this);
        this._runtimeController.enable();
    }

    disable() {
        if (this._runtimeController) {
            this._runtimeController.disable();
            this._runtimeController = null;
        }

        globalThis.debug = null;
    }
}
