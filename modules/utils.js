import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gdk from "gi://Gdk";

export function debug(msg) {
    try {
        if (msg === null) {
            log(`[;;; DEBUG] null`);
        } else if (typeof msg === "object") {
            log(`[;; DEBUG] ${JSON.stringify(msg, getCircularReplacer(), 2)}`);
        } else {
            log(`[;;; DEBUG] ${msg}`);
        }
    } catch (e) {
        log(`[;;; DEBUG] (failed to stringify)`);
        logError(e);
    }
}

function getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "[Circular]";
            }
            seen.add(value);
        }
        return value;
    };
}

export function getBackgroundsDir() {
    const dataDir = GLib.get_user_data_dir();
    return GLib.build_filenamev([
        dataDir,
        "gnome-wallpaper-engine",
        "backgrounds",
    ]);
}

export function ensureBackgroundsDir() {
    const bgDir = getBackgroundsDir();
    const directory = Gio.File.new_for_path(bgDir);

    if (!directory.query_exists(null)) {
        try {
            directory.make_directory_with_parents(null);
        } catch (e) {
            logError(e);
        }
    }

    return directory;
}

export function getMonitors() {
    const display = Gdk.Display.get_default();
    const monitors = display.get_monitors();
    const numMonitors = monitors.get_n_items();

    let monitorList = [];

    for (let i = 0; i < numMonitors; i++) {
        const monitor = monitors.get_item(i);
        const geometry = monitor.get_geometry();

        monitorList.push({
            id: i,
            width: geometry.width,
            height: geometry.height,
            x: geometry.x,
            y: geometry.y,
            model: monitor.get_model() || `Monitor ${i + 1}`,
            scale: monitor.get_scale_factor(),
        });
    }

    return monitorList;
}
