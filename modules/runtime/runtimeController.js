import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { Indicator } from "../../indicator.js";
import { AutoPause } from "../autoPause.js";
import { PlaybackSession } from "./playbackSession.js";
import { debugScope } from "../utils.js";
import { WindowFilter } from "../windowFilter.js";

const WALLPAPER_REFRESH_DELAY_MS = 250;
const AUTOSTART_DELAY_MS = 500;

export class RuntimeController {
    constructor(extension) {
        this._extension = extension;
        this._settings = extension.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine",
        );

        this._indicator = null;
        this._wallpaperChangeTimeoutId = null;
        this._autoStartTimeoutId = null;
        this._settingsSignalIds = [];

        this._windowFilter = new WindowFilter();
        this._playbackSession = new PlaybackSession(this._settings, this._windowFilter);
        this._autoPause = new AutoPause(this._settings, this._playbackSession);
    }

    enable() {
        debugScope("runtime", "enable", {
            autostart: this._settings.get_boolean("autostart"),
            currentWallpaper: this._settings.get_string("current-wallpaper"),
            showIndicator: this._settings.get_boolean("show-indicator"),
        });

        this._windowFilter.enable();
        this._autoPause.start();

        this._settingsSignalIds.push(
            this._settings.connect("changed::show-indicator", () => {
                this._syncIndicatorVisibility();
            }),
        );
        this._settingsSignalIds.push(
            this._settings.connect("changed::current-wallpaper", () => {
                this._scheduleWallpaperRefresh();
            }),
        );
        this._settingsSignalIds.push(
            this._settings.connect("changed::inhibit-sleep", () => {
                this._scheduleWallpaperRefresh();
            }),
        );

        this._syncIndicatorVisibility();
        this._scheduleAutostart();
    }

    disable() {
        debugScope("runtime", "disable");

        this._cancelTimeout(this._wallpaperChangeTimeoutId);
        this._wallpaperChangeTimeoutId = null;

        this._cancelTimeout(this._autoStartTimeoutId);
        this._autoStartTimeoutId = null;

        for (const signalId of this._settingsSignalIds) {
            this._settings.disconnect(signalId);
        }
        this._settingsSignalIds = [];

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._autoPause.stop();
        this._playbackSession.stop();
        this._windowFilter.disable();
    }

    startPlayback() {
        debugScope("runtime", "start requested", {
            currentWallpaper: this._settings.get_string("current-wallpaper"),
        });
        this._playbackSession.start();
    }

    stopPlayback() {
        debugScope("runtime", "stop requested");
        this._playbackSession.stop();
    }

    openPreferences() {
        this._extension.openPreferences();
    }

    isPlaybackRunning() {
        return this._playbackSession.isRunning();
    }

    _syncIndicatorVisibility() {
        const shouldShowIndicator = this._settings.get_boolean("show-indicator");

        if (shouldShowIndicator && !this._indicator) {
            this._indicator = new Indicator(this);
            Main.panel.addToStatusArea(this._extension.uuid, this._indicator);
            return;
        }

        if (!shouldShowIndicator && this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    _scheduleAutostart() {
        debugScope("runtime", "schedule autostart", {
            delayMs: AUTOSTART_DELAY_MS,
        });

        this._cancelTimeout(this._autoStartTimeoutId);
        this._autoStartTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            AUTOSTART_DELAY_MS,
            () => {
                this._autoStartTimeoutId = null;

                if (this._settings.get_boolean("autostart") &&
                    this._settings.get_string("current-wallpaper")) {
                    debugScope("runtime", "autostart firing");
                    this.startPlayback();
                } else {
                    debugScope("runtime", "autostart skipped", {
                        autostart: this._settings.get_boolean("autostart"),
                        currentWallpaper: this._settings.get_string("current-wallpaper"),
                    });
                }

                return GLib.SOURCE_REMOVE;
            },
        );
    }

    _scheduleWallpaperRefresh() {
        debugScope("runtime", "schedule refresh", {
            delayMs: WALLPAPER_REFRESH_DELAY_MS,
            currentWallpaper: this._settings.get_string("current-wallpaper"),
            inhibitSleep: this._settings.get_boolean("inhibit-sleep"),
        });

        this._cancelTimeout(this._wallpaperChangeTimeoutId);
        this._wallpaperChangeTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            WALLPAPER_REFRESH_DELAY_MS,
            () => {
                this._wallpaperChangeTimeoutId = null;

                if (this._settings.get_string("current-wallpaper")) {
                    this.startPlayback();
                } else {
                    this.stopPlayback();
                }

                return GLib.SOURCE_REMOVE;
            },
        );
    }

    _cancelTimeout(timeoutId) {
        if (timeoutId) {
            GLib.source_remove(timeoutId);
        }
    }
}
