import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Cairo from "gi://cairo";

import { WindowUtils } from "./windowUtils.js";
import { StaticWallpaper } from "./staticWallpaper.js";
import { getBackgroundsDir } from "./utils.js";
import { WallpaperClone } from "./wallpaperClone.js";

export class Wallpaper {
    constructor(ext, windowFilter) {
        debug("Wallpaper: Initializing");
        this._ext = ext;
        this._windowFilter = windowFilter;

        this._mpvProcess = null;
        this._wallpaperWindow = null;

        this._raisedSignalId = null;
        this._windowCreatedId = null;
        this._staticWallpaper = new StaticWallpaper();
    }

    start() {
        debug("Wallpaper: Starting...");
        this.stop();

        const settings = this._ext._settings;
        const filename = settings.get_string("current-wallpaper");
        if (!filename) return;
        
        const bgDir = getBackgroundsDir();
        
        const videoPath = GLib.build_filenamev([bgDir, filename]);

        const baseName = filename.substring(0, filename.lastIndexOf("."));
        const thumbPath = GLib.build_filenamev([bgDir, `${baseName}-thumb.webp`]);

        const thumbFile = Gio.File.new_for_path(videoThumbPath);

        const cmd = [
            "mpv",
            "--no-border",
            "--loop=inf",
            "--no-audio",
            "--force-window=immediate",
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
            debug("Wallpaper: Launching mpv process...");
            this._mpvProcess = Gio.Subprocess.new(
                cmd,
                Gio.SubprocessFlags.NONE,
            );

            this._windowCreatedId = global.display.connect(
                "window-created",
                (_, metaWin) => this._handleWindow(metaWin),
            );

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                for (const actor of global.get_window_actors()) {
                    this._handleWindow(actor.get_meta_window());
                }
                return GLib.SOURCE_REMOVE;
            });

            if (thumbFile.query_exists(null)) {
                const thumbUri = thumbFile.get_uri();
                this._staticWallpaper.set(thumbUri);
            }
        } catch (e) {
            debug(`Wallpaper: Error in start(): ${e}`);
        }
    }

    _handleWindow(metaWin) {
        if (!metaWin) return;

        let attempts = 0;
        const maxAttempts = 40;

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            attempts++;

            if (!metaWin) {
                return GLib.SOURCE_REMOVE;
            }

            let title = metaWin.get_title();
            let actor = metaWin.get_compositor_private();

            if (!title || !actor) {
                if (attempts >= maxAttempts) {
                    debug(
                        `Wallpaper: Aborting setup. Actor/Title not loaded after ${maxAttempts} attempts.`,
                    );
                    return GLib.SOURCE_REMOVE;
                }
                return GLib.SOURCE_CONTINUE;
            }

            if (!WindowUtils.isWallpaperWindow(metaWin)) {
                return GLib.SOURCE_REMOVE;
            }

            debug(
                `Wallpaper: Window ready after ${attempts} attempts. Title: "${title}"`,
            );
            this._wallpaperWindow = metaWin;

            if (this._windowFilter) {
                this._windowFilter.addWindow(metaWin);
            }

            metaWin.stick();
            metaWin.focus_on_click = false;
            metaWin.lower();

            try {
                metaWin.set_accept_focus(false);
            } catch (e) {}

            try {
                metaWin.set_input_region(new Cairo.Region());
            } catch (e) {
                debug(`Wallpaper: Region-Error: ${e}`);
            }

            actor.translation_x = -10000;
            actor.translation_y = -10000;
            actor.reactive = false;

            new WallpaperClone(metaWin);

            if (!this._raisedSignalId) {
                this._raisedSignalId = metaWin.connect("raised", () => {
                    metaWin.lower();
                });
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    stop() {
        debug("Wallpaper: Stopping and starting cleanup...");

        if (this._mpvProcess) {
            this._mpvProcess.force_exit();
            this._mpvProcess = null;
        }

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._raisedSignalId && this._wallpaperWindow) {
            this._wallpaperWindow.disconnect(this._raisedSignalId);
            this._raisedSignalId = null;
        }

        if (this._windowFilter && this._wallpaperWindow) {
            this._windowFilter.removeWindow(this._wallpaperWindow);
        }

        this._wallpaperWindow = null;
        debug("Wallpaper: Cleanup complete.");
    }
}
