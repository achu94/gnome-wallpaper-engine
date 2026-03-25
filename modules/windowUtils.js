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
        const monitorIndex = metaWin.get_monitor();
        if (monitorIndex < 0) return false;

        const monitor = global.display.get_monitor_geometry(monitorIndex);
        const rect = metaWin.get_frame_rect();

        return (
            rect.width >= monitor.width &&
            rect.height >= monitor.height
        );
    }
}