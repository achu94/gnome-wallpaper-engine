import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export class WallpaperClone {
    constructor(metaWin) {
        this._metaWin = metaWin;
        this._clones = this._createClones(metaWin);
    }

    _createClones(metaWin) {
        let actor = metaWin.get_compositor_private();
        if (!actor) {
            console.log(
                "Wallpaper: No compositor_private found. Aborting clone creation.",
            );
            return [];
        }

        let clones = [];
        let monitors = Main.layoutManager.monitors;

        Main.notify(`CLONE: ${monitors.length}`);

        for (let monitor of monitors) {
            const clutterClone = new Clutter.Clone({
                source: actor,
                reactive: false,
            });

            clutterClone.set_position(monitor.x, monitor.y);
            clutterClone.set_size(monitor.width, monitor.height);

            Main.layoutManager._backgroundGroup.insert_child_at_index(
                clutterClone,
                0,
            );

            clones.push(clutterClone);
        }

        console.log(`Wallpaper: ${clones.length} clones successfully added.`);
        return clones;
    }

    destroy() {
        this._clones.forEach((clone) => {
            if (clone) {
                clone.destroy();
            }
        });
        this._clones = [];
    }
}
