import GLib from "gi://GLib";

import { WindowUtils } from "../windowUtils.js";

const INITIAL_PLACEMENT_INTERVAL_MS = 100;
const INITIAL_PLACEMENT_ATTEMPTS = 5;
const DESKTOP_SYNC_INTERVAL_MS = 120;
const DESKTOP_SYNC_ATTEMPTS = 8;
const DESKTOP_SYNC_SETTLE_ATTEMPTS = 4;

export class StackingPolicy {
    constructor() {
        this._window = null;
        this._generation = 0;
        this._raisedSignalId = null;
        this._windowMappedId = null;
        this._initialPlacementTimeoutId = null;
        this._desktopSyncTimeoutId = null;
    }

    attach(metaWindow, generation) {
        this.detach();

        this._window = metaWindow;
        this._generation = generation;

        this._placeWindow();
        this._disableInput();

        this._scheduleInitialPlacement();

        this._raisedSignalId = metaWindow.connect("raised", () => {
            this._placeWindow();
            this._scheduleDesktopSync();
        });

        this._windowMappedId = global.window_manager.connect_after(
            "map",
            (_windowManager, windowActor) => {
                const mappedWindow = windowActor?.get_meta_window?.();

                if (!mappedWindow || mappedWindow === this._window) {
                    return;
                }

                this._scheduleDesktopSync();
            },
        );

        this._scheduleDesktopSync();
    }

    detach() {
        this._cancelTimeout(this._initialPlacementTimeoutId);
        this._initialPlacementTimeoutId = null;

        this._cancelTimeout(this._desktopSyncTimeoutId);
        this._desktopSyncTimeoutId = null;

        if (this._raisedSignalId && this._window) {
            this._window.disconnect(this._raisedSignalId);
        }
        this._raisedSignalId = null;

        if (this._windowMappedId) {
            global.window_manager.disconnect(this._windowMappedId);
        }
        this._windowMappedId = null;

        this._window = null;
        this._generation = 0;
    }

    _scheduleInitialPlacement() {
        this._cancelTimeout(this._initialPlacementTimeoutId);

        let attempts = 0;
        const expectedGeneration = this._generation;
        this._initialPlacementTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            INITIAL_PLACEMENT_INTERVAL_MS,
            () => {
                if (!this._isCurrentGeneration(expectedGeneration)) {
                    this._initialPlacementTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                try {
                    this._placeWindow();
                } catch (_) {
                    this._initialPlacementTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                attempts += 1;

                if (attempts >= INITIAL_PLACEMENT_ATTEMPTS) {
                    this._initialPlacementTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    _scheduleDesktopSync() {
        this._cancelTimeout(this._desktopSyncTimeoutId);

        let attempts = 0;
        const expectedGeneration = this._generation;
        this._desktopSyncTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            DESKTOP_SYNC_INTERVAL_MS,
            () => {
                if (!this._isCurrentGeneration(expectedGeneration)) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                try {
                    this._placeWindow();
                } catch (_) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                attempts += 1;

                if (WindowUtils.getDesktopWindows().length > 0 &&
                    attempts >= DESKTOP_SYNC_SETTLE_ATTEMPTS) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                if (attempts >= DESKTOP_SYNC_ATTEMPTS) {
                    this._desktopSyncTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    _placeWindow() {
        if (!this._window) {
            return;
        }

        this._window.lower();
        this._window.stick();
        this._window.focus_on_click = false;

        try {
            this._window.set_accept_focus(false);
        } catch (_) { }
    }

    _disableInput() {
        const window = this._window;

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (window !== this._window) {
                return GLib.SOURCE_REMOVE;
            }

            try {
                window.set_input_region(null);
            } catch (_) { }

            return GLib.SOURCE_REMOVE;
        });
    }

    _isCurrentGeneration(expectedGeneration) {
        return this._window !== null && this._generation === expectedGeneration;
    }

    _cancelTimeout(timeoutId) {
        if (timeoutId) {
            GLib.source_remove(timeoutId);
        }
    }
}
