import GLib from "gi://GLib";

const BIND_RETRY_INTERVAL_MS = 150;
const MAX_BIND_ATTEMPTS = 40;

export class WindowBindingService {
    constructor() {
        this._timeoutId = null;
    }

    bind(matchWindow, onWindowBound, getCurrentGeneration, expectedGeneration) {
        this.cancel();

        let attempts = 0;
        this._timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            BIND_RETRY_INTERVAL_MS,
            () => {
                if (getCurrentGeneration() !== expectedGeneration) {
                    this._timeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                const metaWindow = this._findWindow(matchWindow);
                attempts += 1;

                if (metaWindow) {
                    this._timeoutId = null;
                    onWindowBound(metaWindow);
                    return GLib.SOURCE_REMOVE;
                }

                if (attempts >= MAX_BIND_ATTEMPTS) {
                    this._timeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    cancel() {
        if (!this._timeoutId) {
            return;
        }

        GLib.source_remove(this._timeoutId);
        this._timeoutId = null;
    }

    _findWindow(matchWindow) {
        for (const actor of global.get_window_actors()) {
            const metaWindow = actor.get_meta_window();

            if (matchWindow(metaWindow)) {
                return metaWindow;
            }
        }

        return null;
    }
}
