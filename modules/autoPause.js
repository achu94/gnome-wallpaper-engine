import Gio from "gi://Gio";
import { debugScope } from "./utils.js";
import { WindowUtils } from "./windowUtils.js";

export class AutoPause {
    constructor(settings, playbackController) {
        this._settings = settings;
        this._playbackController = playbackController;
        this._isPaused = false;

        this._onBattery = false;
        this._upower = null;
        this._upowerSignalId = null;
        this._trackedWorkspace = null;
        this._workspaceSignalIds = [];
        this._windowSignalMap = new Map();
        this._activeWorkspaceChangedId = null;

        this._initBattery();
    }

    start() {
        if (this._activeWorkspaceChangedId) return;

        debugScope("autopause", "start");

        this._activeWorkspaceChangedId = global.workspace_manager.connect(
            "active-workspace-changed",
            () => this._trackActiveWorkspace(),
        );
        this._trackActiveWorkspace();
        this._checkConditions();
    }

    stop() {
        debugScope("autopause", "stop");

        if (this._activeWorkspaceChangedId) {
            global.workspace_manager.disconnect(this._activeWorkspaceChangedId);
            this._activeWorkspaceChangedId = null;
        }

        if (this._upower && this._upowerSignalId) {
            this._upower.disconnect(this._upowerSignalId);
            this._upowerSignalId = null;
        }

        this._disconnectWorkspaceSignals();
        this._disconnectWindowSignals();
        this._trackedWorkspace = null;
    }

    _initBattery() {
        try {
            this._upower = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusProxyFlags.NONE,
                null,
                "org.freedesktop.UPower",
                "/org/freedesktop/UPower",
                "org.freedesktop.UPower",
                null
            );

            this._onBattery = this._upower
                .get_cached_property("OnBattery")
                ?.deep_unpack() ?? false;

            this._upowerSignalId = this._upower.connect(
                "g-properties-changed",
                () => {
                    this._onBattery = this._upower
                        .get_cached_property("OnBattery")
                        ?.deep_unpack() ?? false;
                    this._checkConditions();
                }
            );
        } catch (e) {
            logError(e);
        }
    }

    _checkConditions() {
        const fullscreenWindow = this._findFullscreenWindow();
        const hasFullscreen = fullscreenWindow !== null;

        const pauseOnFullscreen = this._settings.get_boolean("pause-on-fullscreen");
        const pauseOnBattery = this._settings.get_boolean("pause-on-battery");

        const shouldPause =
            (pauseOnFullscreen && hasFullscreen) ||
            (pauseOnBattery && this._onBattery);

        debugScope("autopause", "evaluate", {
            shouldPause,
            pauseOnFullscreen,
            hasFullscreen,
            pauseOnBattery,
            onBattery: this._onBattery,
            isPaused: this._isPaused,
            fullscreenWindow: WindowUtils.describeWindow(fullscreenWindow),
        });

        if (!shouldPause && !this._isPaused) {
            return;
        }

        if (shouldPause && !this._isPaused) {
            if (this._playbackController.isRunning()) {
                debugScope("autopause", "pausing playback");
                this._playbackController.stop();
                this._isPaused = true;
            }
        }

        if (!shouldPause && this._isPaused) {
            debugScope("autopause", "resuming playback");
            this._playbackController.start();
            this._isPaused = false;
        }
    }

    _findFullscreenWindow() {
        const windows = this._listTrackedWorkspaceWindows();

        for (const metaWindow of windows) {
            if (!WindowUtils.isPauseEligibleWindow(metaWindow)) {
                continue;
            }

            if (!WindowUtils.isFullscreenLike(metaWindow)) {
                continue;
            }

            if (WindowUtils.fillsMonitor(metaWindow)) {
                return metaWindow;
            }
        }

        return null;
    }

    _trackActiveWorkspace() {
        const activeWorkspace = global.workspace_manager.get_active_workspace();

        if (activeWorkspace === this._trackedWorkspace) {
            return;
        }

        this._disconnectWorkspaceSignals();
        this._disconnectWindowSignals();
        this._trackedWorkspace = activeWorkspace;

        if (!this._trackedWorkspace) {
            return;
        }

        this._workspaceSignalIds.push(
            this._trackedWorkspace.connect("window-added", (_workspace, window) => {
                this._trackWindow(window);
                this._checkConditions();
            }),
        );
        this._workspaceSignalIds.push(
            this._trackedWorkspace.connect("window-removed", (_workspace, window) => {
                this._untrackWindow(window);
                this._checkConditions();
            }),
        );

        for (const metaWindow of this._listTrackedWorkspaceWindows()) {
            this._trackWindow(metaWindow);
        }
    }

    _trackWindow(metaWindow) {
        if (!metaWindow || this._windowSignalMap.has(metaWindow)) {
            return;
        }

        if (!WindowUtils.isPauseEligibleWindow(metaWindow)) {
            return;
        }

        const signalIds = [
            metaWindow.connect("notify::fullscreen", () => this._checkConditions()),
            metaWindow.connect("notify::maximized-horizontally", () => this._checkConditions()),
            metaWindow.connect("notify::maximized-vertically", () => this._checkConditions()),
            metaWindow.connect("notify::minimized", () => this._checkConditions()),
            metaWindow.connect("unmanaged", () => {
                this._untrackWindow(metaWindow);
                this._checkConditions();
            }),
        ];

        this._windowSignalMap.set(metaWindow, signalIds);
    }

    _untrackWindow(metaWindow) {
        const signalIds = this._windowSignalMap.get(metaWindow);

        if (!signalIds) {
            return;
        }

        for (const signalId of signalIds) {
            try {
                metaWindow.disconnect(signalId);
            } catch (_) { }
        }

        this._windowSignalMap.delete(metaWindow);
    }

    _disconnectWorkspaceSignals() {
        if (!this._trackedWorkspace) {
            this._workspaceSignalIds = [];
            return;
        }

        for (const signalId of this._workspaceSignalIds) {
            try {
                this._trackedWorkspace.disconnect(signalId);
            } catch (_) { }
        }

        this._workspaceSignalIds = [];
    }

    _disconnectWindowSignals() {
        for (const metaWindow of this._windowSignalMap.keys()) {
            this._untrackWindow(metaWindow);
        }
    }

    _listTrackedWorkspaceWindows() {
        if (!this._trackedWorkspace) {
            return [];
        }

        try {
            return this._trackedWorkspace.list_windows();
        } catch (_) {
            return [];
        }
    }
}
