import Gio from "gi://Gio";
import GLib from "gi://GLib";

const GRACEFUL_EXIT_SIGNAL = 15;
const FORCE_EXIT_DELAY_MS = 400;

export class ProcessSupervisor {
    constructor() {
        this._process = null;
        this._processId = 0;
        this._generation = 0;
    }

    start(argv) {
        this.stop();

        this._process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        this._processId = this._parseProcessId(this._process);
        this._generation += 1;

        return {
            generation: this._generation,
            process: this._process,
            processId: this._processId,
        };
    }

    stop() {
        if (!this._process) {
            return false;
        }

        const process = this._process;
        this._process = null;
        this._processId = 0;
        this._generation += 1;

        if (this._tryGracefulExit(process)) {
            return true;
        }

        this._forceExit(process);
        return true;
    }

    isRunning() {
        return this._process !== null;
    }

    getProcessId() {
        return this._processId;
    }

    getGeneration() {
        return this._generation;
    }

    _tryGracefulExit(process) {
        try {
            if (typeof process.send_signal !== "function") {
                return false;
            }

            process.send_signal(GRACEFUL_EXIT_SIGNAL);

            GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                FORCE_EXIT_DELAY_MS,
                () => {
                    this._forceExit(process);
                    return GLib.SOURCE_REMOVE;
                },
            );

            return true;
        } catch (_) {
            return false;
        }
    }

    _forceExit(process) {
        try {
            process.force_exit();
        } catch (_) { }
    }

    _parseProcessId(process) {
        const identifier = process?.get_identifier?.();
        const parsedId = identifier ? Number.parseInt(identifier, 10) : 0;

        return Number.isInteger(parsedId) ? parsedId : 0;
    }
}
