export class WindowUtils {
    static isWallpaperWindow(metaWin) {
        if (!metaWin) return false;

        return (
            metaWin.get_title() === "wallpaper_bg" ||
            metaWin.get_wm_class() === "wallpaper_bg"
        );
    }

    static isFullscreenLike(metaWin) {
        return (
            metaWin.is_fullscreen() ||
            metaWin.get_maximized() === 3
        );
    }

    static fillsMonitor(metaWin) {
        if (metaWin.is_fullscreen()) return true;
        if (metaWin.get_maximized() === Meta.MaximizeFlags.BOTH) return true;

        const monitorIndex = metaWin.get_monitor();
        if (monitorIndex < 0) return false;

        const monitor = global.display.get_monitor_geometry(monitorIndex);
        const rect = metaWin.get_frame_rect();

        const tolerance = 5; // kleine Abweichungen erlauben

        return (
            Math.abs(rect.x - monitor.x) < tolerance &&
            Math.abs(rect.y - monitor.y) < tolerance &&
            Math.abs(rect.width - monitor.width) < tolerance &&
            Math.abs(rect.height - monitor.height) < tolerance
        );
    }
}