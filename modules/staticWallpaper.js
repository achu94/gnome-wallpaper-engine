import Gio from "gi://Gio";

export class StaticWallpaper {
    constructor() {
        this._staticWallpaper = null;

        this._settings = new Gio.Settings({
            schema_id: "org.gnome.desktop.background",
        });
    }

    set(imageUri) {
        if (!imageUri.startsWith("file://")) {
            console.error("Der Pfad muss mit 'file://' beginnen.");
            return;
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
