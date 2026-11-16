import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";
import GLib from "gi://GLib";

import { mediaMenu } from "./modules/mediaMenu.js";
import { Wallpaper as LegacyWallpaper } from "./modules/wallpaper.js";
import { Wallpaper as Gnome50Wallpaper } from "./modules/wallpaper50.js";
import { AutoPause } from "./modules/autoPause.js";
import { WindowFilter } from "./modules/windowFilter.js";

import { debug , loadPath } from "./modules/utils.js";

export default class WallpaperExtension extends Extension {
    enable() {
        loadPath();
        this._mpvExists = GLib.find_program_in_path("mpv");
        this._ffmpegExists = GLib.find_program_in_path('ffmpeg');
        this._ytdlpExists = GLib.find_program_in_path("yt-dlp");

        let missing = [];

        if (!this._mpvExists) {
            missing.push("'mpv'");
        }

        if (!this._ffmpegExists) {
            missing.push("'ffmpeg'");
        }

        if (!this._ytdlpExists) {
            missing.push("'yt-dlp'");
        }

        if (missing.length > 0) {
            let msg = "Error: Missing dependencies: " + missing.join(" and ");
            Main.notify("Gnome Live Wallpaper", msg);
            return;
        }

        globalThis.debug = debug;

        this._settings = this.getSettings("org.gnome.shell.extensions.gnome-wallpaper-engine");

        this._mediaMenu = null;

        this._windowFilter = new WindowFilter();
        this._windowFilter.enable();
        const shellMajorVersion = Number.parseInt(PACKAGE_VERSION, 10);
        const WallpaperRenderer = shellMajorVersion >= 50
            ? Gnome50Wallpaper
            : LegacyWallpaper;
        this._wallpaper = new WallpaperRenderer(this, this._windowFilter);

        this._mediaMenuSignalId = this._settings.connect(
            "changed::show-mediamenu",
            () => this._updatemediaMenuVisibility()
        );
        this._updatemediaMenuVisibility();

        this._settingsSignalId = this._settings.connect(
            "changed::current-wallpaper",
            () => this._wallpaper.start()
        );

        this._audioSettingSignalId = this._settings.connect(
            "changed::play-audio",
            () => this._wallpaper.start()
        );

        this._videoSettingSignalId = this._settings.connect(
            "changed::show-video",
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

    _updatemediaMenuVisibility() {
        const show = this._settings.get_boolean("show-mediamenu");

        if (show && !this._mediaMenu) {
            this._mediaMenu = new mediaMenu(this);
            Main.panel.addToStatusArea(this.uuid, this._mediaMenu);
        } else if (!show && this._mediaMenu) {
            this._mediaMenu.destroy();
            this._mediaMenu = null;
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

        if (this._mediaMenuSignalId) {
            this._settings.disconnect(this._mediaMenuSignalId);
            this._mediaMenuSignalId = null;
        }

        if (this._audioSettingSignalId) {
            this._settings.disconnect(this._audioSettingSignalId);
            this._audioSettingSignalId = null;
        }

        if (this._videoSettingSignalId) {
            this._settings.disconnect(this._videoSettingSignalId);
            this._videoSettingSignalId = null;
        }

        if (this._wallpaper) {
            this._wallpaper.destroy();
            this._wallpaper = null;
        }

        if (this._windowFilter) {
            this._windowFilter.disable();
            this._windowFilter = null;
        }

        if (this._mediaMenu) {
            this._mediaMenu.destroy();
            this._mediaMenu = null;
        }

        if (this._autoPause) {
            this._autoPause.stop();
            this._autoPause = null;
        }

        this._settings = null;
    }
}
