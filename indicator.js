import GObject from "gi://GObject";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

export const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, "Wallpaper Bridge");
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

            // AKTIVIEREN
            let playItem = new PopupMenu.PopupMenuItem("▶ Wallpaper Starten");
            playItem.connect("activate", () => {
                this._extension.startWallpaper();
            });
            this.menu.addMenuItem(playItem);

            // STOPPEN
            let stopItem = new PopupMenu.PopupMenuItem("■ Wallpaper Stoppen");
            stopItem.connect("activate", () => {
                this._extension.stopWallpaper();
            });
            this.menu.addMenuItem(stopItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let prefsItem = new PopupMenu.PopupMenuItem("Einstellungen...");
            prefsItem.connect("activate", () =>
                this._extension.openPreferences(),
            );
            this.menu.addMenuItem(prefsItem);
        }
    },
);
