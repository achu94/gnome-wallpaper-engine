import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { buildGalleryPage } from "./prefs/gallery.js";
import { buildGeneralPage } from "./prefs/general.js";
import { buildMultiScreenPage } from "./prefs/multiMonitor.js";

export default class WallpaperPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine"
        );

        window.add(buildGalleryPage(this, window, settings));
        window.add(buildGeneralPage(settings, this));
        window.add(buildMultiScreenPage(settings, this));
    }
}