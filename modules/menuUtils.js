import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { getBackgroundsDir, debug } from "./utils.js";

export function mpvSocket(sessionId, commandArray) {
    if (!sessionId) {
        debug("mpvSocket: Missing sessionId");
        return null;
    }
    const socketPath = `/tmp/mpvsocket/${sessionId}/socket`;
    let connection = null;
    try {
        const address = Gio.UnixSocketAddress.new(socketPath);
        const client = new Gio.SocketClient();
        client.set_timeout(1); // Prevent hanging GNOME Shell main thread if mpv stalls

        connection = client.connect(address, null);
        if (!connection) {
            return null;
        }

        const requestId = Math.floor(Math.random() * 1000000);
        const payload = JSON.stringify({ command: commandArray, request_id: requestId }) + '\n';
        connection.get_output_stream().write_bytes(new GLib.Bytes(payload), null);

        const dataInputStream = new Gio.DataInputStream({ base_stream: connection.get_input_stream() });

        let response = null;
        let maxLines = 50; // Prevent infinite loops on noisy mpv event streams
        while (maxLines-- > 0) {
            const [lineBytes] = dataInputStream.read_line(null);
            if (!lineBytes) break;
            const decoded = new TextDecoder().decode(lineBytes);
            const parsed = JSON.parse(decoded);
            if (parsed.request_id === requestId) {
                response = parsed.data;
                break;
            }
        }

        return response;
    } catch (error) {
        debug(`mpvSocket: ERROR: ${error.message}`);
        return null;
    } finally {
        if (connection) {
            try {
                connection.close(null);
            } catch (_e) {}
        }
    }
}

export function cleanupSocket() {
    // call this in the destroy of MPV, remove dead sockets.
    try {
        GLib.spawn_command_line_sync(`rm -rf /tmp/mpvsocket`);
    } catch (e) {
        debug("Failed to clean socket");
    }
}

const MAX_TICKER_CHARS = 48;
const TICKER_INTERVAL_MS = 400;

export function startTicker(menuItem, fullText) {
    if (!menuItem || !menuItem.label) return;

    // Clear any existing timer on this menu item
    if (menuItem._tickerTimeoutId) {
        GLib.source_remove(menuItem._tickerTimeoutId);
        menuItem._tickerTimeoutId = null;
    }

    const cleanText = fullText || "";
    menuItem._fullTickerText = cleanText;

    // Use Array.from to safely handle multi-byte Unicode/emoji characters
    const chars = Array.from(cleanText);

    if (chars.length <= MAX_TICKER_CHARS) {
        menuItem.label.text = cleanText;
        return;
    }

    const padded = [...chars, " ", "•", " "];
    let offset = 0;

    menuItem.label.text = padded.slice(0, MAX_TICKER_CHARS).join("");

    menuItem._tickerTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        TICKER_INTERVAL_MS,
        () => {
            if (!menuItem || !menuItem.label) {
                return GLib.SOURCE_REMOVE;
            }

            // Pause scrolling when the popup menu is closed to save CPU
            if (this?.menu && !this.menu.isOpen) {
                return GLib.SOURCE_CONTINUE;
            }

            offset = (offset + 1) % padded.length;

            const windowChars = [];
            for (let i = 0; i < MAX_TICKER_CHARS; i++) {
                windowChars.push(padded[(offset + i) % padded.length]);
            }

            menuItem.label.text = windowChars.join("");
            return GLib.SOURCE_CONTINUE;
        }
    );
}

export function cleanupTickers() {
    [this._wallpaperNameLabel, this._chapterNameLabel].forEach((item) => {
        if (item?._tickerTimeoutId) {
            GLib.source_remove(item._tickerTimeoutId);
            item._tickerTimeoutId = null;
        }
    });
    if (this._chapterTimeoutId) {
        GLib.source_remove(this._chapterTimeoutId);
        this._chapterTimeoutId = null;
    }
}

export function updatechapterName() {
    if (!this._chapterNameLabel) {
        debug("updatechapterName: Label is null. EXIT.");
        return;
    }

    if (this._chapterTimeoutId) {
        GLib.source_remove(this._chapterTimeoutId);
        this._chapterTimeoutId = null;
    }

    debug("updatechapterName: scheduling fetch attempt");
    this._chapterTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
        this._chapterTimeoutId = null;
        if (!this._chapterNameLabel) return GLib.SOURCE_REMOVE;

        const wallpaper = this._extension?._wallpaper;
        if (!wallpaper || !this._isWallpaperRunning()) {
            return GLib.SOURCE_REMOVE;
        }

        let title =
            wallpaper._sendCommand(["get_property", "chapter-metadata/title"])

        if (title && typeof title !== "string") {
            title = title.title ? String(title.title) : JSON.stringify(title);
        }

        if (typeof title === "string" && title.length > 0) {
            // If it looks like a chapter dump, try to extract the first title
            if (title.includes('"title":"')) {
                const match = title.match(/"title":"([^"]+)"/);
                if (match && match[1]) {
                    title = match[1];
                }
            }
            debug(`updatechapterName: successfully got title: "${title}"`);
            startTicker.call(this, this._chapterNameLabel, `${title}`);
        } else {
            startTicker.call(this, this._chapterNameLabel, "");
            debug("updatechapterName: failed to get chapter or media title");
        }
        return GLib.SOURCE_REMOVE;
    });
}

export function isWallpaperRunning() {
    const wp = this._extension?._wallpaper;
    if (!wp) return false;
    return !!(wp._process || wp._sessionId || wp._mpvProcess);
}

export function updateControls(forceRunning = false) {
    const running = forceRunning || this._isWallpaperRunning();
    const showVideo = this._extension._settings.get_boolean("show-video");
    const playAudio = this._extension._settings.get_boolean("play-audio");

    // Video Controls
    [
        this._playPauseButton,
        this._prevVideoButton,
        this._nextVideoButton,
        this._seekBackwardButton,
        this._seekForwardButton,
    ].forEach((btn) => {
        btn.reactive = running;
        if (running) {
            btn.remove_style_class_name("disabled");
        } else {
            btn.add_style_class_name("disabled");
        }
    });

    // Start/Stop Button Icon
    if (this._startStopIcon) {
        this._startStopIcon.icon_name = running
            ? "media-playback-stop-symbolic"
            : "media-playback-start-symbolic";
    }

    // Video Toggle
    if (this._videoButton) {
        if (showVideo) {
            this._videoButton.remove_style_class_name("disabled");
        } else {
            this._videoButton.add_style_class_name("disabled");
        }
    }

    // Audio Toggle
    if (this._audioButton) {
        if (playAudio) {
            this._audioButton.remove_style_class_name("disabled");
        } else {
            this._audioButton.add_style_class_name("disabled");
        }
    }

    // Update wallpaper name with ticker
    if (this._wallpaperNameLabel) {
        let currentWallpaper = this._extension?._settings?.get_string("current-wallpaper") || "";
        // Strip off the file extension at the end
        if (currentWallpaper.includes(".")) {
            currentWallpaper = currentWallpaper.substring(0, currentWallpaper.lastIndexOf("."));
        }
        startTicker.call(this, this._wallpaperNameLabel, currentWallpaper);
    }
    this._updatechapterName();
}

export function getWallpaperList() {
    const bgDir = getBackgroundsDir(this._extension._settings);
    const directory = Gio.File.new_for_path(bgDir);
    const supported = [".m3u", ".mp4", ".webm", ".gif", ".mkv", ".mov", ".avi"];
    const files = [];

    try {
        if (!directory.query_exists(null)) return files;

        const enumerator = directory.enumerate_children(
            "standard::name",
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const fileName = info.get_name();
            if (supported.some((ext) => fileName.toLowerCase().endsWith(ext))) {
                files.push(fileName);
            }
        }
    } catch (e) {
        console.error(e);
    }
    return files.sort();
}

export function scrollWallpaper(direction) {
    const list = this._getWallpaperList();
    if (list.length === 0) return;

    const current = this._extension._settings.get_string("current-wallpaper");
    let index = list.indexOf(current);

    if (index === -1) {
        index = direction === "prev" ? list.length - 1 : 0;
    } else if (direction === "next") {
        index = (index + 1) % list.length;
    } else if (direction === "prev") {
        index = (index - 1 + list.length) % list.length;
    }

    this._extension._settings.set_string("current-wallpaper", list[index]);
    this._updateControls();
}
