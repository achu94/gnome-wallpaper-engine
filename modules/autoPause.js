import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { WindowUtils } from "./windowUtils.js";

export class AutoPause {
    constructor(ext, wallpaper) {
        this._ext = ext;
        this._settings = ext._settings;
        this._wallpaper = wallpaper;

        this._timeoutId = null;
        this._isPaused = false;

        this._onBattery = false;
        this._upower = null;
        this._upowerSignalId = null;

        this._initBattery();
    }

    start() {
        if (this._timeoutId) return;

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._checkConditions();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stop() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._upower && this._upowerSignalId) {
            this._upower.disconnect(this._upowerSignalId);
            this._upowerSignalId = null;
        }
    }

    _initBattery() {
        try {
            this._upower = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.NONE,
                null,
                "org.freedesktop.UPower",
                "/org/freedesktop/UPower",
                "org.freedesktop.UPower",
                null
            );

            this._onBattery = this._upower
                .get_cached_property("OnBattery")
                ?.deep_unpack() ?? false;

            this._upowerSignalId = this._upower.connect(
                "g-properties-changed",
                () => {
                    this._onBattery = this._upower
                        .get_cached_property("OnBattery")
                        ?.deep_unpack() ?? false;
                }
            );
        } catch (e) {
            logError(e);
        }
    }

    _checkConditions() {
        const hasFullscreen = this._hasFullscreenWindow();

        const pauseOnFullscreen = this._settings.get_boolean("pause-on-fullscreen");
        const pauseOnBattery = this._settings.get_boolean("pause-on-battery");

        const shouldPause =
            (pauseOnFullscreen && hasFullscreen) ||
            (pauseOnBattery && this._onBattery);

        if (!shouldPause && !this._isPaused) {
            return;
        }

        if (shouldPause && !this._isPaused) {
            this._wallpaper.stop();
            this._isPaused = true;
        }

        if (!shouldPause && this._isPaused) {
            this._wallpaper.start();
            this._isPaused = false;
        }
    }

    _hasFullscreenWindow() {
        const windows = global.get_window_actors();

        for (const actor of windows) {
            const metaWin = actor.get_meta_window();
            if (!metaWin) continue;

            if (WindowUtils.isWallpaperWindow(metaWin)) continue;
            if (!WindowUtils.isFullscreenLike(metaWin)) continue;

            if (WindowUtils.fillsMonitor(metaWin)) {
                return true;
            }
        }

        return false;
    }
}