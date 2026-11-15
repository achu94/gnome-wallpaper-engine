import Cairo from "cairo";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Meta from "gi://Meta";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { StaticWallpaper } from "./staticWallpaper.js";
import { getBackgroundsDir } from "./utils.js";
import {
    buildScalingArgs,
    parseMonitorConfig,
    resolveMonitor,
} from "./monitorConfig.js";

const RENDERER_WINDOW_PREFIX = "gwe-wallpaper-";
const MAP_TIMEOUT_MS = 5000;
const OFFSCREEN_GAP = 1;

// Mutter skips CPU culling for actors with an active effect. Without this,
// the off-screen source is culled as fully obscured on fractionally scaled
// monitors, so mpv stops receiving frames and the clones freeze.
const NoCullEffect = GObject.registerClass(
    class NoCullEffect extends Clutter.Effect {}
);

function getMonitorBounds(monitors) {
    if (!monitors.length) return null;

    const x = Math.min(...monitors.map(({ x }) => x));
    const y = Math.min(...monitors.map(({ y }) => y));
    const right = Math.max(...monitors.map(({ x, width }) => x + width));
    const bottom = Math.max(...monitors.map(({ y, height }) => y + height));
    return { x, y, width: right - x, height: bottom - y };
}

// layoutManager.monitors index -> connector name ("DP-3"). Falls back to
// "monitor-<index>" if Mutter's monitor manager isn't reachable.
function getConnectorsByIndex() {
    const byIndex = new Map();
    try {
        const manager = global.backend.get_monitor_manager();
        for (const monitor of manager.get_monitors()) {
            const connector = monitor.get_connector();
            const index = manager.get_monitor_for_connector(connector);
            if (index >= 0) byIndex.set(index, connector);
        }
    } catch (error) {
        console.error("[Wallpaper] Could not read monitor connectors:", error);
    }
    return byIndex;
}

function thumbPathFor(bgDir, filename) {
    const dot = filename.lastIndexOf(".");
    const baseName = dot === -1 ? filename : filename.substring(0, dot);
    return GLib.build_filenamev([bgDir, `${baseName}-thumb.jpg`]);
}

export class Wallpaper {
    constructor(ext, windowFilter) {
        this._ext = ext;
        this._windowFilter = windowFilter;
        this._staticWallpaper = new StaticWallpaper();
        // One session per monitor: { connector, monitor, key, settings,
        // sessionId, process, sourceActor, clone, mapTimeoutId }
        this._sessions = [];
        this._running = false;

        this._windowMapId = global.window_manager.connect_after(
            "map",
            (_windowManager, windowActor) => this._onWindowMapped(windowActor)
        );
        this._monitorsChangedId = Main.layoutManager.connect(
            "monitors-changed",
            () => {
                if (this._running) this.start();
            }
        );
    }

    // What each monitor should show right now, from settings.
    _desiredSessions() {
        const settings = this._ext._settings;
        const defaultFile = settings.get_string("current-wallpaper");
        const config = parseMonitorConfig(settings.get_string("monitor-config"));
        const mode = settings.get_string("wallpaper-mode");
        const connectors = getConnectorsByIndex();

        return Main.layoutManager.monitors
            .map((monitor) => {
                const connector = connectors.get(monitor.index) ?? `monitor-${monitor.index}`;
                const resolved = resolveMonitor(config, connector, defaultFile, mode);
                return {
                    connector,
                    monitor,
                    settings: resolved,
                    // Restart a monitor only when something that affects it changed.
                    key: JSON.stringify([resolved, monitor.x, monitor.y, monitor.width, monitor.height]),
                };
            })
            .filter(({ settings }) => settings.file !== "");
    }

    start() {
        this.stop();
        this._running = true;
        this._sync();
    }

    // Apply changed settings, restarting only the monitors whose settings changed.
    refresh() {
        if (!this._running) {
            this.start();
            return;
        }
        this._sync();
    }

    _sync() {
        if (!GLib.getenv("WAYLAND_DISPLAY") || !Meta.WaylandClient?.new_subprocess) {
            Main.notify("Gnome Live Wallpaper", "GNOME Shell 50 on Wayland is required.");
            return;
        }

        const mpvPath = GLib.find_program_in_path("mpv");
        if (!mpvPath) {
            Main.notify("Gnome Live Wallpaper", "mpv was not found.");
            return;
        }

        const desired = this._desiredSessions();
        const bgDir = getBackgroundsDir();

        // Static fallback (shown while stopped/paused): the default wallpaper's
        // thumbnail, or the first monitor's if there is no default.
        const staticFile = this._ext._settings.get_string("current-wallpaper") || desired[0]?.settings.file;
        if (staticFile) this._staticWallpaper.set(thumbPathFor(bgDir, staticFile));

        const wanted = new Map(desired.map((d) => [d.connector, d]));
        for (const session of [...this._sessions]) {
            const want = wanted.get(session.connector);
            if (want && want.key === session.key) {
                wanted.delete(session.connector); // unchanged, keep playing
            } else {
                this._stopSession(session);
            }
        }

        for (const want of wanted.values()) {
            this._startSession(want, mpvPath, bgDir);
        }
    }

    _startSession({ connector, monitor, settings, key }, mpvPath, bgDir) {
        const sessionId = GLib.uuid_string_random();
        const session = {
            connector,
            monitor,
            settings,
            key,
            sessionId,
            process: null,
            sourceActor: null,
            clone: null,
            mapTimeoutId: null,
        };

        const argv = [
            mpvPath,
            "--vo=gpu",
            "--gpu-context=wayland",
            "--hwdec=auto",
            "--no-border",
            "--loop-file=inf",
            "--no-audio",
            "--force-window=immediate",
            `--title=${RENDERER_WINDOW_PREFIX}${sessionId}`,
            `--geometry=${monitor.width}x${monitor.height}+0+0`,
            "--keepaspect-window=no",
            "--no-auto-window-resize",
            ...buildScalingArgs(settings),
            "--osc=no",
            "--osd-bar=no",
            "--input-default-bindings=no",
            "--input-vo-keyboard=no",
            "--cursor-autohide=no",
            "--no-terminal",
            GLib.build_filenamev([bgDir, settings.file]),
        ];

        try {
            const launcher = new Gio.SubprocessLauncher({ flags: Gio.SubprocessFlags.NONE });
            try {
                const waylandClient = Meta.WaylandClient.new_subprocess(global.context, launcher, argv);
                session.process = waylandClient.get_subprocess();
            } finally {
                if (launcher.close) launcher.close();
            }
            if (!session.process) throw new Error("Could not start the mpv Wayland client");
        } catch (error) {
            console.error(`[Wallpaper] Error starting renderer for ${connector}:`, error);
            Main.notify("Gnome Live Wallpaper", error.message);
            return;
        }

        this._sessions.push(session);

        const process = session.process;
        process.wait_async(null, (subprocess, result) => {
            try {
                subprocess.wait_finish(result);
            } catch (error) {
                logError(error);
            }
            if (session.process !== process) return; // stopped on purpose
            session.process = null;
            const crashed = !process.get_successful();
            this._stopSession(session);
            if (crashed) {
                Main.notify("Gnome Live Wallpaper", `mpv stopped unexpectedly on ${connector}.`);
            }
        });

        session.mapTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, MAP_TIMEOUT_MS, () => {
            session.mapTimeoutId = null;
            if (this._sessions.includes(session) && !session.sourceActor) {
                Main.notify("Gnome Live Wallpaper", `The mpv window for ${connector} could not be attached.`);
                this._stopSession(session);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _onWindowMapped(windowActor) {
        if (!this._sessions.length) return;

        const metaWindow = windowActor.get_meta_window();
        const title = metaWindow?.get_title();
        if (!title?.startsWith(RENDERER_WINDOW_PREFIX)) return;

        const session = this._sessions.find(
            (s) => !s.sourceActor && title === `${RENDERER_WINDOW_PREFIX}${s.sessionId}`
        );
        if (!session) return;

        const backgroundGroup = Main.layoutManager._backgroundGroup;
        const bounds = getMonitorBounds(Main.layoutManager.monitors);
        if (!bounds || !backgroundGroup) {
            Main.notify("Gnome Live Wallpaper", "GNOME's wallpaper layer is unavailable.");
            this._stopSession(session);
            return;
        }

        try {
            this._attach(session, windowActor, metaWindow, backgroundGroup, bounds);
        } catch (error) {
            console.error("[Wallpaper] Error attaching renderer:", error);
            Main.notify("Gnome Live Wallpaper", error.message);
            this._stopSession(session);
        }
    }

    _attach(session, windowActor, metaWindow, backgroundGroup, bounds) {
        const { monitor } = session;

        metaWindow.set_type(Meta.WindowType.DESKTOP);
        metaWindow.stick();
        metaWindow.focus_on_click = false;
        if (typeof metaWindow.set_accept_focus === "function") {
            metaWindow.set_accept_focus(false);
        }
        try {
            metaWindow.set_input_region(new Cairo.Region());
        } catch (_) {
            // Some windowing backends don't support assigning an empty input region.
        }

        session.sourceActor = windowActor;
        const parent = windowActor.get_parent();
        if (parent) parent.remove_child(windowActor);
        backgroundGroup.add_child(windowActor);
        windowActor.set_opacity(255);
        windowActor.set_reactive(false);
        windowActor.add_effect_with_name("gwe-no-cull", new NoCullEffect());

        // The visible copy sits on its monitor; the real window is parked off-screen.
        const clone = new Clutter.Clone({ source: windowActor });
        clone.set_position(monitor.x - bounds.x, monitor.y - bounds.y);
        clone.set_size(monitor.width, monitor.height);
        clone.set_clip_to_allocation(true);
        clone.set_reactive(false);
        backgroundGroup.add_child(clone);
        session.clone = clone;

        // Park each source left of the desktop in a slot fixed by monitor index,
        // so sources never overlap even after only some monitors restart.
        const offset = Main.layoutManager.monitors
            .filter((m) => m.index <= monitor.index)
            .reduce((sum, m) => sum + m.width + OFFSCREEN_GAP, 0);
        metaWindow.move_resize_frame(true, bounds.x - offset, monitor.y, monitor.width, monitor.height);
        windowActor.set_position(-offset, monitor.y - bounds.y);
        windowActor.set_size(monitor.width, monitor.height);
        metaWindow.lower();
        this._windowFilter?.addWindow(metaWindow);

        if (session.mapTimeoutId) {
            GLib.source_remove(session.mapTimeoutId);
            session.mapTimeoutId = null;
        }

        windowActor.connect("destroy", () => {
            this._windowFilter?.removeWindow(metaWindow);
            if (session.sourceActor !== windowActor) return;
            session.sourceActor = null;
            session.clone?.destroy();
            session.clone = null;
        });
    }

    _stopSession(session) {
        const index = this._sessions.indexOf(session);
        if (index !== -1) this._sessions.splice(index, 1);

        if (session.mapTimeoutId) {
            GLib.source_remove(session.mapTimeoutId);
            session.mapTimeoutId = null;
        }
        session.clone?.destroy();
        session.clone = null;
        session.sourceActor = null;

        const process = session.process;
        session.process = null;
        if (process) process.force_exit();
    }

    stop() {
        this._running = false;
        for (const session of [...this._sessions]) this._stopSession(session);
    }

    destroy() {
        this.stop();
        if (this._windowMapId) {
            global.window_manager.disconnect(this._windowMapId);
            this._windowMapId = null;
        }
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
    }
}
