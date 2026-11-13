import GObject from "gi://GObject";
import St from "gi://St";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { getBackgroundsDir } from "./modules/utils.js";

export const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, "Wallpaper Engine");
            this._extension = extension;

            this.add_child(
                new St.Icon({
                    icon_name: "video-display-symbolic",
                    style_class: "system-status-icon",
                })
            );

            this._buildMenu();
        }

        _isWallpaperRunning() {
            const wp = this._extension._wallpaper;
            if (!wp) return false;
            return !!(wp._process || wp._sessionId);
        }

        _updateControls(forceRunning = false) {
            const running = forceRunning || this._isWallpaperRunning();

            // Video Controls
            [this._playPauseButton, this._prevVideoButton, this._nextVideoButton].forEach((btn) => {
                btn.reactive = running;
                if (running) {
                    btn.remove_style_class_name("disabled");
                } else {
                    btn.add_style_class_name("disabled");
                }
            });

            // Start/Stop Button Icon
            this._startStopButton.child = running ? this._stopIcon : this._startIcon;
        }

        _scrollWallpaper(direction) {
            const list = this._getWallpaperList();
            if (list.length === 0) return;
            const current = this._extension._settings.get_string("current-wallpaper");
            let index = list.indexOf(current);
            if (index === -1) {
                index = direction === "prev" ? list.length - 1 : 0;
            } else {
                if (direction === "next") {
                    index = (index + 1) % list.length;
                } else if (direction === "prev") {
                    index = (index - 1 + list.length) % list.length;
                }
            }
          this._extension._settings.set_string("current-wallpaper", list[index]);
          this._updateControls();
        }

        _getWallpaperList() {
            const bgDir = getBackgroundsDir(this._extension._settings);
            const directory = Gio.File.new_for_path(bgDir);
            const supported = [".m3u",".mp4", ".webm", ".gif", ".mkv", ".mov", ".avi"];
            const files = [];

            try {
                if (!directory.query_exists(null)) return files;

                const enumerator = directory.enumerate_children(
                    "standard::name",
                    Gio.FileQueryInfoFlags.NONE,
                    null,
                );

                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    const fileName = info.get_name();
                    if (supported.some((ext) => fileName.toLowerCase().endsWith(ext))) {
                        files.push(fileName);
                    }
                }
            } catch (e) {
                console.error(e);
            }
            return files.sort();
        }

        _buildMenu() {
            this.menu.removeAll();

            // Wallpaper Controls Section
            const title = new PopupMenu.PopupMenuItem("Wallpaper", { reactive: false });
            title.add_style_class_name("title");
            this.menu.addMenuItem(title);

            const controlsItem = new PopupMenu.PopupBaseMenuItem({
                reactive: false,
                can_focus: false,
            });

            const controlsBox = new St.BoxLayout({
                style_class: "controls-container",
                orientation: Clutter.Orientation.HORIZONTAL,
                x_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });

            this._startIcon = new St.Icon({
                icon_name: "media-playback-start-symbolic",
                style_class: "popup-menu-icon",
            });
            this._stopIcon = new St.Icon({
                icon_name: "media-playback-stop-symbolic",
                style_class: "popup-menu-icon",
            });

            this._startStopButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
            });

            this._startStopButton.connect("clicked", () => {
                if (this._isWallpaperRunning()) {
                    this._extension._wallpaper.stop();
                } else {
                    this._extension._wallpaper.start();
                }
                this._updateControls();
            });

            const prevIcon = new St.Icon({
                icon_name: "media-skip-backward-symbolic",
                style_class: "popup-menu-icon",
            });

            const prevButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: prevIcon,
            });

            const nextIcon = new St.Icon({
                icon_name: "media-skip-forward-symbolic",
                style_class: "popup-menu-icon",
            });

            const nextButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: nextIcon,
            });

            prevButton.connect("clicked", () => {
                this._scrollWallpaper("prev");
            });

            nextButton.connect("clicked", () => {
                this._scrollWallpaper("next");
            });

            controlsBox.add_child(prevButton);
            controlsBox.add_child(this._startStopButton);
            controlsBox.add_child(nextButton);
            controlsItem.add_child(controlsBox);
            this.menu.addMenuItem(controlsItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

           // Video Controls Section
            const videoTitle = new PopupMenu.PopupMenuItem("Video", { reactive: false });
            videoTitle.add_style_class_name("title");
            this.menu.addMenuItem(videoTitle);

            const videoControlsItem = new PopupMenu.PopupBaseMenuItem({
                reactive: false,
                can_focus: false,
            });

            const videoControlsVBox = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: true,
            });

            const videoControlsBox = new St.BoxLayout({
                style_class: "controls-container",
                orientation: Clutter.Orientation.HORIZONTAL,
                x_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });

            // Add both icons, to avoid comlpexity of is playing to switch.
            const playIcon = new St.Icon({
                icon_name: "media-playback-start-symbolic",
                style_class: "popup-menu-icon",
            });
            const pauseIcon = new St.Icon({
                icon_name: "media-playback-pause-symbolic",
                style_class: "popup-menu-icon",
            });
            const playPauseBox = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
            });
            playPauseBox.add_child(playIcon);
            playPauseBox.add_child(pauseIcon);

            this._playPauseButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: playPauseBox,
            });

            this._playPauseButton.connect("clicked", () => {
                this._extension._wallpaper._sendCommand(["cycle", "pause"]);
            });

            this._prevVideoButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: new St.Icon({
                    icon_name: "media-skip-backward-symbolic",
                    style_class: "popup-menu-icon",
                }),
            });
            this._prevVideoButton.connect("clicked", () => {
              this._extension._wallpaper._sendCommand(["add", "chapter", -1]);
            });

            this._nextVideoButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: new St.Icon({
                    icon_name: "media-skip-forward-symbolic",
                    style_class: "popup-menu-icon",
                }),
            });
            this._nextVideoButton.connect("clicked", () => {
              this._extension._wallpaper._sendCommand(["add", "chapter", 1]);
            });

            videoControlsBox.add_child(this._prevVideoButton);
            videoControlsBox.add_child(this._playPauseButton);
            videoControlsBox.add_child(this._nextVideoButton);
            videoControlsVBox.add_child(videoControlsBox);
            videoControlsItem.add_child(videoControlsVBox);
            this.menu.addMenuItem(videoControlsItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const prefsMenu = new PopupMenu.PopupMenuItem("Settings");
               prefsMenu.connect("activate", () => {
                   this._extension.openPreferences();
               });
             this.menu.addMenuItem(prefsMenu);

             //Future Development to select selectChapters
             //const selectChapters = new PopupMenu.PopupMenuItem("Settings");
             //selectChapters.connect("activate", () => {
             //this._extension._wallpaper._sendCommand(["context-menu"]);
             //});
             //this.menu.addMenuItem(selectChapters);

          // By setting to true we force it to be running os init.
            this._updateControls(true);
        }

        destroy() {
            this._extension = null;
            super.destroy();
        }
    }
);
