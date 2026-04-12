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
        this._windowMappedId = null;
        this._initialPlacementTimeoutId = null;
        this._desktopSyncTimeoutId = null;
    }

    start() {
        this.stop();

        const settings = this._ext._settings;
        const filename = settings.get_string("current-wallpaper");
        if (!filename) return;
        
        const bgDir = getBackgroundsDir();
        
        const videoPath = GLib.build_filenamev([bgDir, filename]);

        const baseName = filename.substring(0, filename.lastIndexOf("."));
        const thumbPath = GLib.build_filenamev([bgDir, `${baseName}-thumb.webp`]);

        this._staticWallpaper.set(thumbPath);

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

            this._findWindowTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                150,
                findWindow
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
                this._configureWallpaperWindow(metaWin);
                return true;
            }
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

        if (this._initialPlacementTimeoutId) {
            GLib.source_remove(this._initialPlacementTimeoutId);
            this._initialPlacementTimeoutId = null;
        }

        if (this._desktopSyncTimeoutId) {
            GLib.source_remove(this._desktopSyncTimeoutId);
            this._desktopSyncTimeoutId = null;
        }

        if (this._raisedSignalId && this._wallpaperWindow) {
            this._wallpaperWindow.disconnect(this._raisedSignalId);
            this._raisedSignalId = null;
        }

        if (this._windowMappedId) {
            global.window_manager.disconnect(this._windowMappedId);
            this._windowMappedId = null;
        }

        if (this._windowFilter && this._wallpaperWindow) {
            this._windowFilter.removeWindow(this._wallpaperWindow);
        }

        this._wallpaperWindow = null;
    }

    _configureWallpaperWindow(metaWin) {
        this._placeWallpaperWindow(metaWin);
        this._disableWallpaperInput(metaWin);

        if (this._wallpaperWindow) return;

        this._wallpaperWindow = metaWin;

        if (this._windowFilter) {
            this._windowFilter.addWindow(metaWin);
        }

        this._scheduleInitialPlacement(metaWin);

        this._raisedSignalId = metaWin.connect("raised", () => {
            this._placeWallpaperWindow(metaWin);
            this._scheduleDesktopSync();
        });

        this._windowMappedId = global.window_manager.connect_after(
            "map",
            (_windowManager, windowActor) => {
                const mappedWindow = windowActor?.get_meta_window?.();

                if (!mappedWindow || mappedWindow === this._wallpaperWindow) {
                    return;
                }

                this._scheduleDesktopSync();
            },
        );

        this._scheduleDesktopSync();
    }

    _placeWallpaperWindow(metaWin) {
        metaWin.lower();
        metaWin.stick();
        metaWin.focus_on_click = false;

        try {
            metaWin.set_accept_focus(false);
        } catch (_) { }
    }

    _disableWallpaperInput(metaWin) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            try {
                metaWin.set_input_region(null);
            } catch (_) { }
            return GLib.SOURCE_REMOVE;
        });
    }

    _scheduleInitialPlacement(metaWin) {
        if (this._initialPlacementTimeoutId) {
            GLib.source_remove(this._initialPlacementTimeoutId);
        }

        let attempts = 0;
        this._initialPlacementTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            100,
            () => {
                try {
                    this._placeWallpaperWindow(metaWin);
                } catch (_) {
                    this._initialPlacementTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                attempts++;

                if (attempts >= 5) {
                    this._initialPlacementTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    _scheduleDesktopSync() {
        if (this._desktopSyncTimeoutId) {
            GLib.source_remove(this._desktopSyncTimeoutId);
        }

        let attempts = 0;
        this._desktopSyncTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            120,
            () => {
                if (!this._wallpaperWindow) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                try {
                    this._placeWallpaperWindow(this._wallpaperWindow);
                } catch (_) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                attempts++;

                if (WindowUtils.getDesktopWindows().length > 0 && attempts >= 4) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                if (attempts >= 8) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            },
        );
    }
}
