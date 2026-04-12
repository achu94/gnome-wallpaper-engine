import Gio from "gi://Gio";
import GLib from "gi://GLib";

export class StaticWallpaper {
    constructor() {
        this._appliedWallpaperUri = null;
        this._originalWallpaperUri = null;

        this._settings = new Gio.Settings({
            schema_id: "org.gnome.desktop.background",
        });
    }

    set(filePath) {
        if (!filePath) return false;

        let imageUri = filePath;

        if (!filePath.startsWith("file://")) {
            try {
                imageUri = GLib.filename_to_uri(filePath, null);
            } catch (e) {
                console.error("static wallpaper was not found");
                return false;
            }
        }

        if (!this._originalWallpaperUri) {
            this._originalWallpaperUri = this._settings.get_string("picture-uri");
        }

        this._settings.set_string("picture-uri", imageUri);
        this._settings.set_string("picture-uri-dark", imageUri);

        Gio.Settings.sync();

        this._appliedWallpaperUri = imageUri;
        return true;
    }

    restore() {
        if (!this._appliedWallpaperUri || !this._originalWallpaperUri) {
            return;
        }

        this._settings.set_string("picture-uri", this._originalWallpaperUri);
        this._settings.set_string("picture-uri-dark", this._originalWallpaperUri);
        Gio.Settings.sync();

        this._appliedWallpaperUri = null;
        this._originalWallpaperUri = null;
    }
}
