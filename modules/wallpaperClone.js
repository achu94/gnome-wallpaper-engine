import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class WallpaperClone {

    constructor(metaWin) {
        this._metaWin = metaWin;
        this._clone = this._createClone(metaWin);
    }

    _createClone(metaWin) {
        if (!metaWin || !WindowUtils.isWallpaperWindow(metaWin)) {
            log("Wallpaper: Window not allowed. Skipping clone.");
            return null;
        }

        let actor = metaWin.get_compositor_private();
        if (!actor) {
            log("Wallpaper: No compositor_private found. Aborting clone creation.");
            return null;
        }

        const clutterClone = new Clutter.Clone({
            source: actor,
            reactive: false,
            layout_manager: null,
        });

        let monitor = Main.layoutManager.primaryMonitor;
        clutterClone.set_position(monitor.x, monitor.y);
        clutterClone.set_size(monitor.width, monitor.height);

        Main.layoutManager._backgroundGroup.insert_child_at_index(clutterClone, 0);
        clutterClone.lower_bottom();

        log("Wallpaper: Clone successfully added to _backgroundGroup.");
        return clutterClone;
    }
}