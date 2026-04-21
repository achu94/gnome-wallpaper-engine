export class WindowUtils {
    static isWallpaperWindow(metaWin) {
        if (!metaWin) return false;

        const title = metaWin.get_title() ?? "";
        const instance = metaWin.get_wm_class_instance?.() ?? "";
        return title.startsWith("wallpaper_bg") || instance.startsWith("wallpaper_bg");
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
