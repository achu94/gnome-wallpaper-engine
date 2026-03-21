import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

export default class WallpaperPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine",
        );
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: "Live Wallpaper Galerie",
            description:
                "Füge neue Videos hinzu oder wähle eines aus der Liste aus.",
        });
        page.add(group);

        // --- BUTTON: NEUES VIDEO HINZUFÜGEN ---
        const addButton = new Gtk.Button({
            label: "Video/GIF hinzufügen",
            icon_name: "list-add-symbolic",
            margin_bottom: 20,
            css_classes: ["suggested-action"],
        });

        // --- GALERIE (FLOWBOX) ---
        const flowBox = new Gtk.FlowBox({
            valign: Gtk.Align.START,
            max_children_per_line: 3,
            min_children_per_line: 2,
            selection_mode: Gtk.SelectionMode.SINGLE,
            row_spacing: 15,
            column_spacing: 15,
            margin_top: 10,
        });

        // FUNKTION: Galerie neu laden
        const refreshGallery = () => {
            let child = flowBox.get_first_child();
            while (child) {
                flowBox.remove(child);
                child = flowBox.get_first_child();
            }

            const bgDir = this.path + "/backgrounds";
            const directory = Gio.File.new_for_path(bgDir);

            if (!directory.query_exists(null)) {
                directory.make_directory_with_parents(null);
            }

            try {
                let enumerator = directory.enumerate_children(
                    "standard::name",
                    Gio.FileQueryInfoFlags.NONE,
                    null,
                );
                let info;
                const supported = [".mp4", ".webm", ".gif", ".mkv", ".mov"];

                while ((info = enumerator.next_file(null)) !== null) {
                    let fileName = info.get_name();
                    if (
                        supported.some((ext) =>
                            fileName.toLowerCase().endsWith(ext),
                        )
                    ) {
                        let item = this._createWallpaperItem(bgDir, fileName);
                        flowBox.append(item);
                    }
                }
            } catch (e) {
                console.error("Fehler beim Laden der Galerie: " + e);
            }
        };

        // EVENT: Datei auswählen und "säubern"
        addButton.connect("clicked", () => {
            const chooser = new Gtk.FileChooserNative({
                title: "Video Datei auswählen",
                action: Gtk.FileChooserAction.OPEN,
                modal: true,
                transient_for: window,
            });

            const filter = new Gtk.FileFilter();
            filter.set_name("Video-Formate & GIFs");
            filter.add_mime_type("video/mp4");
            filter.add_mime_type("video/webm");
            filter.add_mime_type("image/gif");
            filter.add_mime_type("video/x-matroska");
            chooser.add_filter(filter);

            chooser.connect("response", (res, response_id) => {
                if (response_id === Gtk.ResponseType.ACCEPT) {
                    let sourceFile = chooser.get_file();
                    let originalName = sourceFile.get_basename();

                    // --- NAMEN SÄUBERN (Fix für "mp412345" Fehler) ---
                    let extension = ".mp4"; // Standard-Fallback
                    if (originalName.toLowerCase().includes(".webm"))
                        extension = ".webm";
                    else if (originalName.toLowerCase().includes(".gif"))
                        extension = ".gif";
                    else if (originalName.toLowerCase().includes(".mkv"))
                        extension = ".mkv";

                    // Name vor dem ersten Punkt nehmen und saubere Endung dranhängen
                    let cleanName = originalName.split(".")[0] + extension;

                    let destPath = this.path + "/backgrounds/" + cleanName;
                    let destFile = Gio.File.new_for_path(destPath);

                    try {
                        sourceFile.copy(
                            destFile,
                            Gio.FileCopyFlags.OVERWRITE,
                            null,
                            null,
                        );
                        refreshGallery(); // Galerie sofort aktualisieren
                    } catch (e) {
                        console.error("Kopierfehler: " + e);
                    }
                }
                chooser.destroy();
            });

            chooser.show();
        });

        // EVENT: Klick auf ein Item in der Galerie
        flowBox.connect("child-activated", (box, child) => {
            let selectedFile = child.get_child()._fullPath;
            settings.set_string("current-wallpaper", selectedFile);
            console.log("Wallpaper ausgewählt: " + selectedFile);
        });

        // Initiales Laden beim Öffnen der Einstellungen
        refreshGallery();

        group.add(addButton);
        group.add(flowBox);
        window.add(page);
    }

    // Hilfsfunktion: Erstellt die Kachel für die Galerie
    _createWallpaperItem(dir, fileName) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            halign: Gtk.Align.CENTER,
        });
        box._fullPath = fileName;

        // Falls ein .jpg existiert, nutze es als Vorschau
        let baseName = fileName.substring(0, fileName.lastIndexOf("."));
        let thumbPath = dir + "/" + baseName + ".jpg";
        let thumbFile = Gio.File.new_for_path(thumbPath);

        let image;
        if (thumbFile.query_exists(null)) {
            image = Gtk.Picture.new_for_filename(thumbPath);
        } else {
            image = new Gtk.Image({
                icon_name: "video-x-generic-symbolic",
                pixel_size: 64,
            });
        }

        image.set_size_request(180, 100);
        if (image instanceof Gtk.Picture) {
            image.set_content_fit(Gtk.ContentFit.COVER);
        }

        const label = new Gtk.Label({
            label: baseName,
            max_width_chars: 15,
            ellipsize: 3,
            halign: Gtk.Align.CENTER,
        });

        box.append(image);
        box.append(label);
        return box;
    }
}
