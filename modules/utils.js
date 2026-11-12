import GLib from "gi://GLib";
import Gio from "gi://Gio";

export function loadPath() {
    // We need this as different distros and install mechanism drop mpv,ffmeg and yt-dlp
    // in different places, sometimes they are only included in the userspace.
    const currentPath = GLib.getenv("PATH") || "";
    const homeBin = GLib.build_filenamev([GLib.get_home_dir(), ".local", "bin"]);
    if (!currentPath.includes(homeBin)) {
        GLib.setenv("PATH", `${homeBin}:${currentPath}`, true);
    }
}

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
