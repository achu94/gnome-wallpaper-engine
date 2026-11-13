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

export function getBackgroundsDir(settings = null) {
    try {
        const s = settings || new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.gnome-wallpaper-engine' });
        const customDir = s.get_string("backgrounds-directory");
        
        if (customDir && customDir !== '') {
            return customDir;
        }
    } catch (e) {
        // Fallback if schema is not found or fails to load
    }

    const videosDir = GLib.get_user_special_dir(GLib.UserDirectory.G_USER_DIRECTORY_VIDEOS);
    return GLib.build_filenamev([videosDir, "wallpapers"]);
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
