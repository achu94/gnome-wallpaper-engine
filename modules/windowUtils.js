import Meta from "gi://Meta";

export class WindowUtils {
    static isWallpaperWindow(metaWin) {
        if (!metaWin) return false;

        return (
            metaWin.get_title() === "wallpaper_bg" ||
            metaWin.get_wm_class() === "wallpaper_bg"
        );
    }

    static _getTitle(metaWin) {
        return metaWin?.get_title?.() ?? metaWin?.title ?? "";
    }

    static _getWmClass(metaWin) {
        return metaWin?.get_wm_class?.() ?? "";
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
}
