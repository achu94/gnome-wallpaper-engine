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
            title: "Live Wallpaper Gallery",
            description: "Supported: MP4, WebM, MKV, MOV, AVI, GIF",
        });
        page.add(group);

        const addButton = new Gtk.Button({
            label: "Add Video/GIF",
            icon_name: "list-add-symbolic",
            margin_bottom: 20,
            css_classes: ["suggested-action"],
        });

        const flowBox = new Gtk.FlowBox({
            valign: Gtk.Align.START,
            max_children_per_line: 3,
            min_children_per_line: 2,
            selection_mode: Gtk.SelectionMode.SINGLE,
            row_spacing: 15,
            column_spacing: 15,
            margin_top: 10,
        });

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
                const supported = [".mp4", ".webm", ".gif", ".mkv", ".mov", ".avi"];

                while ((info = enumerator.next_file(null)) !== null) {
                    let fileName = info.get_name();
                    if (supported.some((ext) => fileName.toLowerCase().endsWith(ext))) {
                        let item = this._createWallpaperItem(bgDir, fileName);
                        flowBox.append(item);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };

        addButton.connect("clicked", () => {
            const chooser = new Gtk.FileChooserNative({
                title: "Select Video or GIF",
                action: Gtk.FileChooserAction.OPEN,
                modal: true,
                transient_for: window,
            });

            const filter = new Gtk.FileFilter();
            filter.set_name("Wallpapers (Video/GIF)");
            filter.add_mime_type("video/mp4");
            filter.add_mime_type("video/webm");
            filter.add_mime_type("image/gif");
            filter.add_mime_type("video/x-matroska");
            filter.add_mime_type("video/quicktime");
            filter.add_mime_type("video/x-msvideo");
            chooser.add_filter(filter);

            chooser.connect("response", (res, response_id) => {
                if (response_id === Gtk.ResponseType.ACCEPT) {
                    let sourceFile = chooser.get_file();
                    let originalName = sourceFile.get_basename();

                    let lastDotIndex = originalName.lastIndexOf(".");
                    let extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex).toLowerCase() : ".mp4";
                    let basePart = originalName.substring(0, lastDotIndex !== -1 ? lastDotIndex : originalName.length);
                    let cleanName = basePart + extension;

                    let destPath = this.path + "/backgrounds/" + cleanName;
                    let destFile = Gio.File.new_for_path(destPath);

                    try {
                        sourceFile.copy(
                            destFile,
                            Gio.FileCopyFlags.OVERWRITE,
                            null,
                            null,
                        );
                        refreshGallery();
                    } catch (e) {
                        console.error(e);
                    }
                }
                chooser.destroy();
            });

            chooser.show();
        });

        flowBox.connect("child-activated", (box, child) => {
            let selectedFile = child.get_child()._fullPath;
            settings.set_string("current-wallpaper", selectedFile);
        });

        refreshGallery();

        group.add(addButton);
        group.add(flowBox);
        window.add(page);
    }

    _createWallpaperItem(dir, fileName) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            halign: Gtk.Align.CENTER,
        });
        box._fullPath = fileName;

        let lastDotIndex = fileName.lastIndexOf(".");
        let baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;

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