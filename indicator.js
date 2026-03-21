import GObject from "gi://GObject";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

export const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, "Wallpaper Engine");
            this._extension = extension;

            this.add_child(
                new St.Icon({
                    icon_name: "video-display-symbolic",
                    style_class: "system-status-icon",
                }),
            );

            this._buildMenu();
        }

        _buildMenu() {
            this.menu.removeAll();

            let playItem = new PopupMenu.PopupMenuItem("▶ Start Wallpaper");
            playItem.connect("activate", () => {
                this._extension.startWallpaper();
            });
            this.menu.addMenuItem(playItem);

            let stopItem = new PopupMenu.PopupMenuItem("■ Stop Wallpaper");
            stopItem.connect("activate", () => {
                this._extension.stopWallpaper();
            });
            this.menu.addMenuItem(stopItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let prefsItem = new PopupMenu.PopupMenuItem("Settings...");
            prefsItem.connect("activate", () =>
                this._extension.openPreferences(),
            );
            this.menu.addMenuItem(prefsItem);
        }
    },
);