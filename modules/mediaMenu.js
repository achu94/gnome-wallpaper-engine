import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Pango from "gi://Pango";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { debug } from "./utils.js";
import {
    isWallpaperRunning,
    updateControls,
    scrollWallpaper,
    getWallpaperList,
    updatechapterName,
    cleanupTickers,
} from "./menuUtils.js";

export const mediaMenu = GObject.registerClass(
    class mediaMenu extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, "Wallpaper Engine");
            this._extension = extension;
            this._updateControls = (...args) => {
                debug("mediaMenu: calling _updateControls");
                updateControls.apply(this, args);
            };
            this._isWallpaperRunning = isWallpaperRunning.bind(this);
            this._scrollWallpaper = scrollWallpaper.bind(this);
            this._getWallpaperList = getWallpaperList.bind(this);
            this._updatechapterName = (...args) => {
                debug("mediaMenu: calling _updatechapterName");
                updatechapterName.apply(this, args);
            };
            this._cleanupTickers = cleanupTickers.bind(this);

            this.add_child(
                new St.Icon({
                    icon_name: "video-display-symbolic",
                    style_class: "system-status-icon",
                })
            );

            this._buildMenu();

            this._settingsSignalId = this._extension._settings.connect(
                "changed::current-wallpaper",
                () => {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        if (!this._extension) return GLib.SOURCE_REMOVE;
                        this._updateControls();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            );
        }

        _buildMenu() {
            this._cleanupTickers();
            this.menu.removeAll();

            // Wallpaper Controls Section
            const title = new PopupMenu.PopupMenuItem("Wallpaper Menu", { reactive: false });
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

            this._startStopIcon = new St.Icon({
                icon_name: "media-playback-start-symbolic",
                style_class: "popup-menu-icon",
            });

            this._startStopButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: this._startStopIcon,
            });

            this._startStopButton.connect("clicked", () => {
                if (this._isWallpaperRunning()) {
                    this._extension._wallpaper.stop();
                } else {
                    this._extension._wallpaper.start();
                }
                this._updateControls();
            });

            const prevButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: new St.Icon({
                    icon_name: "media-skip-backward-symbolic",
                    style_class: "popup-menu-icon",
                }),
            });

            const nextButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: new St.Icon({
                    icon_name: "media-skip-forward-symbolic",
                    style_class: "popup-menu-icon",
                }),
            });

            prevButton.connect("clicked", () => this._scrollWallpaper("prev"));
            nextButton.connect("clicked", () => this._scrollWallpaper("next"));

            // Video Toggle Button
            this._videoButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
            });
            this._videoButton.child = new St.Icon({
                icon_name: "video-display-symbolic",
                style_class: "popup-menu-icon",
            });
            this._videoButton.connect("clicked", () => {
                const currentVideo = this._extension._settings.get_boolean("show-video");
                const currentAudio = this._extension._settings.get_boolean("play-audio");
                if (currentVideo && !currentAudio) {
                    this._extension._settings.set_boolean("play-audio", true);
                }
                this._extension._settings.set_boolean("show-video", !currentVideo);
                this._updateControls();
            });

            // Audio Toggle Button
            this._audioButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
            });
            this._audioButton.child = new St.Icon({
                icon_name: "audio-speakers-symbolic",
                style_class: "popup-menu-icon",
            });
            this._audioButton.connect("clicked", () => {
                const currentVideo = this._extension._settings.get_boolean("show-video");
                const currentAudio = this._extension._settings.get_boolean("play-audio");
                if (currentAudio && !currentVideo) {
                    this._extension._settings.set_boolean("show-video", true);
                }
                this._extension._settings.set_boolean("play-audio", !currentAudio);
                this._updateControls();
            });

            controlsBox.add_child(prevButton);
            controlsBox.add_child(this._startStopButton);
            controlsBox.add_child(nextButton);
            controlsBox.add_child(this._videoButton);
            controlsBox.add_child(this._audioButton);

            controlsItem.add_child(controlsBox);
            this.menu.addMenuItem(controlsItem);

            const wallpaperNameItem = new PopupMenu.PopupMenuItem("Wallpaper", { reactive: false });
            wallpaperNameItem.label.add_style_class_name("wallpaper-name");
            wallpaperNameItem.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.menu.addMenuItem(wallpaperNameItem);
            this._wallpaperNameLabel = wallpaperNameItem;

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Video Controls Section
            const videoTitle = new PopupMenu.PopupMenuItem("Media Menu", { reactive: false });
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
                reactive: false,
                can_focus: false,
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
              this._updatechapterName();
            });

            this._seekBackwardButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: new St.Icon({
                    icon_name: "media-seek-backward-symbolic",
                    style_class: "popup-menu-icon",
                }),
            });
            this._seekBackwardButton.connect("clicked", () => {
                this._extension._wallpaper._sendCommand(["seek", -10]);
            });

            this._seekForwardButton = new St.Button({
                can_focus: true,
                style_class: "menubutton",
                child: new St.Icon({
                    icon_name: "media-seek-forward-symbolic",
                    style_class: "popup-menu-icon",
                }),
            });
            this._seekForwardButton.connect("clicked", () => {
                this._extension._wallpaper._sendCommand(["seek", 10]);
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
              this._updatechapterName();
            });

            videoControlsBox.add_child(this._prevVideoButton);
            videoControlsBox.add_child(this._seekBackwardButton);
            videoControlsBox.add_child(this._playPauseButton);
            videoControlsBox.add_child(this._seekForwardButton);
            videoControlsBox.add_child(this._nextVideoButton);
            videoControlsVBox.add_child(videoControlsBox);
            videoControlsItem.add_child(videoControlsVBox);
            this.menu.addMenuItem(videoControlsItem);

            const chapterName = new PopupMenu.PopupMenuItem("Chapter Name: ", { reactive: false });
            chapterName.label.add_style_class_name("wallpaper-name");
            chapterName.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.menu.addMenuItem(chapterName);
            this._chapterNameLabel = chapterName;

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const prefsMenu = new PopupMenu.PopupMenuItem("Open Media Gallery");
            prefsMenu.connect("activate", () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(prefsMenu);

            this._updateControls(this._extension._settings.get_boolean("autostart"));
        }

        destroy() {
            this._cleanupTickers();
            if (this._settingsSignalId) {
                this._extension._settings.disconnect(this._settingsSignalId);
                this._settingsSignalId = null;
            }
            this._extension = null;
            super.destroy();
        }
    }
);
