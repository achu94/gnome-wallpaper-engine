import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { buildGalleryPage } from "./prefs/gallery.js";
import { buildGeneralPage } from "./prefs/general.js";
import { debug , loadPath } from "./modules/utils.js";

export default class WallpaperPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        loadPath();
        const settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine"
        );

        const provider = new Gtk.CssProvider();
        provider.load_from_file(Gio.File.new_for_path(this.dir.get_path() + "/stylesheet.css"));
        Gtk.StyleContext.add_provider_for_display(
            window.get_display(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        window.add(buildGalleryPage(this, window, settings));
        window.add(buildGeneralPage(settings, this, window));
    }
}
