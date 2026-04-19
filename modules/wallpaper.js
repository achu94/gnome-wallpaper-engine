import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { WindowUtils } from "./windowUtils.js";
import { getBackgroundsDir } from "./utils.js";

export class Wallpaper {
    constructor(ext, windowFilter) {
        this._ext = ext;
        this._windowFilter = windowFilter;

        this._mpvProcesses = [];
        this._wallpaperWindows = [];
        this._findWindowTimeoutId = null;
    }

    start() {
        this.stop();

        const settings = this._ext._settings;
        const filename = settings.get_string("current-wallpaper");
        if (!filename) return;

        const videoPath = GLib.build_filenamev([getBackgroundsDir(), filename]);

        const monitors = this.monitors();

        // 🌍 Gesamte virtuelle Desktopfläche berechnen
        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        for (const m of monitors) {
            minX = Math.min(minX, m.x);
            minY = Math.min(minY, m.y);
            maxX = Math.max(maxX, m.x + m.width);
            maxY = Math.max(maxY, m.y + m.height);
        }

        const width = maxX - minX;
        const height = maxY - minY;

        // 🎬 EIN mpv für alles
        const cmd = [
            "mpv",
            "--no-border",
            "--loop=inf",
            "--no-audio",
            "--force-window=yes",
            "--keep-open=yes",
            "--no-osc",
            "--no-osd-bar",
            "--hwdec=auto",

            // 🧠 wichtig für Stretch / Fill
            "--video-unscaled=no",
            "--panscan=1.0",

            // 🖥️ gesamte Desktopfläche
            `--geometry=${width}x${height}+${minX}+${minY}`,

            "--title=wallpaper",
            "--x11-name=wallpaper",

            videoPath,
        ];

        const proc = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
        this._mpvProcesses.push(proc);

        this._trackWindows();
    }

    _trackWindows() {
        let attempts = 0;

        this._findWindowTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            200,
            () => {
                this._applyWindowRules();

                attempts++;
                if (attempts > 60) return GLib.SOURCE_REMOVE;

                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    _applyWindowRules() {
        const actors = global.get_window_actors();

        for (const actor of actors) {
            const win = actor.get_meta_window();

            if (!WindowUtils.isWallpaperWindow(win)) continue;

            if (this._wallpaperWindows.includes(win)) continue;

            this._wallpaperWindows.push(win);

            win.stick();
            win.lower();

            try {
                win.set_accept_focus(false);
            } catch {}
            win.focus_on_click = false;

            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                try {
                    win.set_input_region(null);
                } catch {}
                return GLib.SOURCE_REMOVE;
            });

            // dauerhaft unten halten
            let count = 0;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                try {
                    win.lower();
                } catch {}
                return ++count < 10;
            });

            win.connect("raised", () => win.lower());

            global.display.connect("window-created", () => {
                this._wallpaperWindows.forEach((w) => w.lower());
            });

            if (this._windowFilter) this._windowFilter.addWindow(win);
        }
    }

    stop() {
        this._mpvProcesses.forEach((p) => {
            try {
                p.force_exit();
            } catch {}
        });

        this._mpvProcesses = [];
        this._wallpaperWindows = [];

        if (this._findWindowTimeoutId) {
            GLib.source_remove(this._findWindowTimeoutId);
            this._findWindowTimeoutId = null;
        }
    }

    monitors() {
        const display = global.display;
        const n = display.get_n_monitors();

        const list = [];

        for (let i = 0; i < n; i++) {
            const g = display.get_monitor_geometry(i);

            list.push({
                x: g.x,
                y: g.y,
                width: g.width,
                height: g.height,
            });
        }

        return list;
    }
}
