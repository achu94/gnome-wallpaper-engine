import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { buildGalleryPage } from "./prefs/gallery.js";
import { buildGeneralPage } from "./prefs/general.js";
import { buildDisplaysPage } from "./prefs/displays.js";

export default class WallpaperPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine"
        );

        const displaysPage = buildDisplaysPage(settings);
        window.add(buildGalleryPage(this, window, settings, {
            onFilesChanged: () => displaysPage.refreshFiles(),
        }));
        window.add(displaysPage);
        window.add(buildGeneralPage(settings, this));
    }
}