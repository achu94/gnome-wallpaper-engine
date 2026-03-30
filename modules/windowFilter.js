import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

export class WindowFilter {
    constructor() {
        this._hidden = new Set();
        this._originals = [];
    }

    addWindow(metaWindow) {
        if (metaWindow)
            this._hidden.add(metaWindow);
    }

    removeWindow(metaWindow) {
        this._hidden.delete(metaWindow);
    }

    _override(obj, method, replacement) {
        const original = obj[method];
        this._originals.push([obj, method, original]);
        obj[method] = replacement(original);
    }

    enable() {
        const hidden = this._hidden;

        // global actors (dock, etc.)
        this._override(global, 'get_window_actors', original => {
            return function () {
                return original.call(this).filter(actor => {
                    const win = actor.get_meta_window();
                    return !hidden.has(win);
                });
            };
        });

        // Alt+Tab
        this._override(Meta.Display.prototype, 'get_tab_list', original => {
            return function (type, workspace) {
                return original.call(this, type, workspace)
                    .filter(win => !hidden.has(win));
            };
        });

        // Overview
        this._override(Workspace.Workspace.prototype, '_isOverviewWindow', original => {
            return function (win) {
                if (hidden.has(win)) return false;
                return original.call(this, win);
            };
        });

        this._override(WorkspaceThumbnail.WorkspaceThumbnail.prototype, '_isOverviewWindow', original => {
            return function (win) {
                if (hidden.has(win)) return false;
                return original.call(this, win);
            };
        });

        // App-System
        this._override(Shell.WindowTracker.prototype, 'get_window_app', original => {
            return function (win) {
                if (hidden.has(win)) return null;
                return original.call(this, win);
            };
        });

        this._override(Shell.App.prototype, 'get_windows', original => {
            return function () {
                return original.call(this)
                    .filter(win => !hidden.has(win));
            };
        });

        this._override(Shell.AppSystem.prototype, 'get_running', original => {
            return function () {
                return original.call(this)
                    .filter(app => app.get_windows().length > 0);
            };
        });
    }

    disable() {
        for (const [obj, method, original] of this._originals) {
            obj[method] = original;
        }
        this._originals = [];
        this._hidden.clear();
    }
}