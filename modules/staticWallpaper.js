import Gio from "gi://Gio";
import GLib from "gi://GLib";

export class StaticWallpaper {
    constructor() {
        this._staticWallpaper = null;

        this._settings = new Gio.Settings({
            schema_id: "org.gnome.desktop.background",
        });
    }

    set(filePath) {
        if (!filePath) return;

        let imageUri = filePath;

        if (!filePath.startsWith("file://")) {
            try {
                imageUri = GLib.filename_to_uri(filePath, null);
            } catch (e) {
                console.error("static wallpaper was not found");
                return;
            }
        }

        this._settings.set_string("picture-uri", imageUri);
        this._settings.set_string("picture-uri-dark", imageUri);

        Gio.Settings.sync();

        this._staticWallpaper = imageUri;
    }

    get() {
        const currentUri = this._settings.get_string("picture-uri");

        this._staticWallpaper = currentUri;
        return currentUri;
    }
}
