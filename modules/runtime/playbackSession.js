import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { detectMediaType } from "../media/mediaTypes.js";
import { StaticWallpaper } from "../staticWallpaper.js";
import { debugScope, getBackgroundsDir } from "../utils.js";
import { WindowUtils } from "../windowUtils.js";
import { ProcessSupervisor } from "./processSupervisor.js";
import { StackingPolicy } from "./stackingPolicy.js";
import { WindowBindingService } from "./windowBindingService.js";

const WALLPAPER_WINDOW_CLASS = WindowUtils.WALLPAPER_WINDOW_CLASS;
const RESTART_SETTLE_DELAY_MS = 450;

export class PlaybackSession {
    constructor(settings, windowFilter) {
        this._settings = settings;
        this._windowFilter = windowFilter;
        this._staticWallpaper = new StaticWallpaper();
        this._processSupervisor = new ProcessSupervisor();
        this._windowBindingService = new WindowBindingService();
        this._stackingPolicy = new StackingPolicy();

        this._boundWindow = null;
        this._hasAppliedWallpaper = false;
        this._windowIdentity = null;
        this._pendingStartTimeoutId = null;
    }

    start() {
        const selection = this._buildSelection();

        debugScope("playback", "start requested", {
            selection,
        });

        if (!selection) {
            this.stop();
            return;
        }

        const shouldDelayRestart = this.stop();
        const startDelay = shouldDelayRestart ? RESTART_SETTLE_DELAY_MS : 0;

        this._scheduleStart(selection, startDelay);
    }

    stop() {
        debugScope("playback", "stop requested", {
            hadBoundWindow: Boolean(this._boundWindow),
            hadAppliedWallpaper: this._hasAppliedWallpaper,
            processRunning: this._processSupervisor.isRunning(),
        });

        this._cancelPendingStart();
        this._windowBindingService.cancel();
        this._stackingPolicy.detach();

        if (this._windowFilter && this._boundWindow) {
            this._windowFilter.removeWindow(this._boundWindow);
        }

        this._boundWindow = null;
        this._hasAppliedWallpaper = false;
        this._windowIdentity = null;

        const hadRunningProcess = this._processSupervisor.stop();
        this._staticWallpaper.restore();

        return hadRunningProcess;
    }

    isRunning() {
        return this._hasAppliedWallpaper ||
            this._processSupervisor.isRunning() ||
            this._boundWindow !== null;
    }

    _bindWindow(metaWindow) {
        debugScope("playback", "binding window", {
            title: metaWindow?.get_title?.() || "",
            wmClass: metaWindow?.get_wm_class?.() || "",
        });
        this._boundWindow = metaWindow;

        if (this._windowFilter) {
            this._windowFilter.addWindow(metaWindow);
        }

        this._stackingPolicy.attach(metaWindow, this._processSupervisor.getGeneration());
    }

    _buildSelection() {
        const filename = this._settings.get_string("current-wallpaper");

        if (!filename) {
            return null;
        }

        const backgroundsDirectory = getBackgroundsDir();
        const mediaPath = `${backgroundsDirectory}/${filename}`;
        const mediaType = detectMediaType(filename);

        if (!Gio.File.new_for_path(mediaPath).query_exists(null)) {
            debugScope("playback", "selection missing media file", {
                filename,
                mediaPath,
            });
            return null;
        }

        const baseName = filename.substring(0, filename.lastIndexOf("."));
        const thumbnailPath = `${backgroundsDirectory}/${baseName}-thumb.webp`;
        const staticWallpaperPath = mediaType === "image" ? mediaPath : thumbnailPath;

        return {
            filename,
            mediaPath,
            mediaType,
            staticWallpaperPath,
            shouldInhibitSleep: this._settings.get_boolean("inhibit-sleep"),
        };
    }

    _buildCommand(selection, sessionToken) {
        return [
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
            `--stop-screensaver=${selection.shouldInhibitSleep ? "yes" : "no"}`,
            `--title=${sessionToken}`,
            `--x11-name=${WALLPAPER_WINDOW_CLASS}`,
            "--panscan=1.0",
            "--video-unscaled=no",
            "--input-default-bindings=no",
            "--input-vo-keyboard=no",
            "--cursor-autohide=no",
            "--hwdec=auto",
            selection.mediaPath,
        ];
    }

    _scheduleStart(selection, delayMs) {
        this._cancelPendingStart();
        debugScope("playback", "schedule start", {
            delayMs,
            mediaType: selection.mediaType,
            fileName: selection.filename,
        });

        this._pendingStartTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            delayMs,
            () => {
                this._pendingStartTimeoutId = null;
                this._startSelection(selection);
                return GLib.SOURCE_REMOVE;
            },
        );
    }

    _startSelection(selection) {
        debugScope("playback", "start selection", {
            fileName: selection.filename,
            mediaType: selection.mediaType,
            staticWallpaperPath: selection.staticWallpaperPath,
            shouldInhibitSleep: selection.shouldInhibitSleep,
        });

        if (selection.staticWallpaperPath) {
            this._hasAppliedWallpaper = this._staticWallpaper.set(
                selection.staticWallpaperPath,
            );
            debugScope("playback", "applied static wallpaper", {
                fileName: selection.filename,
                applied: this._hasAppliedWallpaper,
            });
        }

        if (selection.mediaType === "image") {
            debugScope("playback", "image selection does not require mpv");
            return;
        }

        const sessionToken = `wallpaper_bg:${Date.now()}`;
        const descriptor = this._processSupervisor.start(
            this._buildCommand(selection, sessionToken),
        );

        this._windowIdentity = {
            processId: descriptor.processId,
            titlePrefix: sessionToken,
            wmClass: WALLPAPER_WINDOW_CLASS,
        };

        this._windowBindingService.bind(
            (metaWindow) => WindowUtils.isWallpaperWindow(metaWindow, this._windowIdentity),
            this._bindWindow.bind(this),
            () => this._processSupervisor.getGeneration(),
            descriptor.generation,
        );
    }

    _cancelPendingStart() {
        if (!this._pendingStartTimeoutId) {
            return;
        }

        GLib.source_remove(this._pendingStartTimeoutId);
        this._pendingStartTimeoutId = null;
    }
}
