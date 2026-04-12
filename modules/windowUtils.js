import Meta from "gi://Meta";

const DEFAULT_WALLPAPER_TITLE_PREFIX = "wallpaper_bg";
const DEFAULT_WALLPAPER_WINDOW_CLASS = "wallpaper_bg";

export class WindowUtils {
    static get WALLPAPER_TITLE_PREFIX() {
        return DEFAULT_WALLPAPER_TITLE_PREFIX;
    }

    static get WALLPAPER_WINDOW_CLASS() {
        return DEFAULT_WALLPAPER_WINDOW_CLASS;
    }

    static isWallpaperWindow(metaWin, identity = null) {
        if (!metaWin) return false;

        const titlePrefix = identity?.titlePrefix ?? DEFAULT_WALLPAPER_TITLE_PREFIX;
        const wmClass = identity?.wmClass ?? DEFAULT_WALLPAPER_WINDOW_CLASS;
        const processId = identity?.processId ?? 0;

        const matchesWallpaperIdentity = (
            this._getTitle(metaWin).startsWith(titlePrefix) ||
            this._getWmClass(metaWin) === wmClass
        );

        if (!matchesWallpaperIdentity) {
            return false;
        }

        if (!processId) {
            return true;
        }

        try {
            const windowPid = metaWin.get_pid?.() ?? 0;

            if (!windowPid) {
                return true;
            }

            return windowPid === processId;
        } catch (_) {
            return true;
        }
    }

    static _getTitle(metaWin) {
        return metaWin?.get_title?.() ?? metaWin?.title ?? "";
    }

    static _getWmClass(metaWin) {
        return metaWin?.get_wm_class?.() ?? "";
    }

    static _getWindowType(metaWin) {
        try {
            return metaWin?.get_window_type?.() ?? null;
        } catch (_) {
            return null;
        }
    }

    static _isSkipTaskbar(metaWin) {
        try {
            return metaWin?.is_skip_taskbar?.() ?? false;
        } catch (_) {
            return false;
        }
    }

    static _isMinimized(metaWin) {
        try {
            return Boolean(metaWin?.minimized);
        } catch (_) {
            return false;
        }
    }

    static _isDesktopWindowType(metaWin) {
        try {
            return metaWin?.get_window_type?.() === Meta.WindowType.DESKTOP;
        } catch (_) {
            return false;
        }
    }

    static _hasDingDesktopTitle(metaWin) {
        const title = this._getTitle(metaWin);

        return (
            title.startsWith("Desktop Icons ") ||
            /^@![^;]+;.*B.*D.*H.*F/.test(title)
        );
    }

    static _hasDesktopLikeClass(metaWin) {
        const wmClass = this._getWmClass(metaWin).toLowerCase();

        return wmClass.includes("ding") || wmClass.includes("conky");
    }

    static isDesktopWindow(metaWin) {
        if (!metaWin || this.isWallpaperWindow(metaWin)) return false;

        return (
            this._isDesktopWindowType(metaWin) ||
            this._hasDingDesktopTitle(metaWin) ||
            this._hasDesktopLikeClass(metaWin)
        );
    }

    static isSystemSurfaceWindow(metaWin) {
        if (!metaWin) {
            return false;
        }

        if (this.isDesktopWindow(metaWin)) {
            return true;
        }

        return this._isSkipTaskbar(metaWin);
    }

    static isPauseEligibleWindow(metaWin) {
        if (!metaWin) {
            return false;
        }

        if (this.isWallpaperWindow(metaWin)) {
            return false;
        }

        if (this.isSystemSurfaceWindow(metaWin)) {
            return false;
        }

        if (this._isMinimized(metaWin)) {
            return false;
        }

        return true;
    }

    static getDesktopWindows() {
        return global
            .get_window_actors()
            .map((actor) => actor.get_meta_window())
            .filter((metaWin) => this.isDesktopWindow(metaWin));
    }

    static _isWindowMaximized(metaWin) {
        if (typeof metaWin.is_maximized === "function") {
            // GNOME 49+
            return metaWin.is_maximized();
        } else {
            // GNOME 48 and older (3 corresponds to Meta.MaximizeFlags.BOTH)
            return metaWin.get_maximized() === 3;
        }
    }

    static isFullscreenLike(metaWin) {
        return metaWin.is_fullscreen() || this._isWindowMaximized(metaWin);
    }

    static fillsMonitor(metaWin) {
        if (metaWin.is_fullscreen()) return true;
        if (this._isWindowMaximized(metaWin)) return true;

        const monitorIndex = metaWin.get_monitor();
        if (monitorIndex < 0) return false;

        const monitor = global.display.get_monitor_geometry(monitorIndex);
        const rect = metaWin.get_frame_rect();

        const tolerance = 5;

        return (
            Math.abs(rect.x - monitor.x) < tolerance &&
            Math.abs(rect.y - monitor.y) < tolerance &&
            Math.abs(rect.width - monitor.width) < tolerance &&
            Math.abs(rect.height - monitor.height) < tolerance
        );
    }

    static describeWindow(metaWin) {
        if (!metaWin) {
            return null;
        }

        let frameRect = null;

        try {
            const rect = metaWin.get_frame_rect?.();
            frameRect = rect
                ? {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                }
                : null;
        } catch (_) { }

        return {
            title: this._getTitle(metaWin),
            wmClass: this._getWmClass(metaWin),
            pid: metaWin.get_pid?.() ?? 0,
            monitor: metaWin.get_monitor?.() ?? -1,
            windowType: this._getWindowType(metaWin),
            skipTaskbar: this._isSkipTaskbar(metaWin),
            minimized: this._isMinimized(metaWin),
            fullscreen: metaWin.is_fullscreen?.() ?? false,
            maximized: this._isWindowMaximized(metaWin),
            desktopWindow: this.isDesktopWindow(metaWin),
            frameRect,
        };
    }
}
