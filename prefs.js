import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

export default class WallpaperPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine",
        );

        // --- PAGE 1: GALLERY (First Tab) ---
        const pageGallery = new Adw.PreferencesPage({
            title: "Gallery",
            icon_name: "folder-videos-symbolic",
        });

        const galleryGroup = new Adw.PreferencesGroup({
            title: "Live Wallpaper Selection",
            description: "Supported formats: MP4, WebM, MKV, MOV, AVI, GIF",
        });
        pageGallery.add(galleryGroup);

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
                    let destPath = this.path + "/backgrounds/" + originalName;
                    let destFile = Gio.File.new_for_path(destPath);

                    try {
                        sourceFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);
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
        galleryGroup.add(addButton);
        galleryGroup.add(flowBox);
        window.add(pageGallery);

        // --- PAGE 2: GENERAL SETTINGS (Second Tab) ---
        const pageGeneral = new Adw.PreferencesPage({
            title: "General",
            icon_name: "preferences-system-symbolic",
        });

        const behaviorGroup = new Adw.PreferencesGroup({
            title: "Behavior",
            description: "Configure how the extension starts and displays",
        });
        pageGeneral.add(behaviorGroup);

        // Autostart Row
        const autostartRow = new Adw.ActionRow({
            title: "Autostart",
            subtitle: "Automatically start the wallpaper when you log in",
        });
        const autostartSwitch = new Gtk.Switch({
            active: settings.get_boolean("autostart"),
            valign: Gtk.Align.CENTER,
        });
        settings.bind("autostart", autostartSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        autostartRow.add_suffix(autostartSwitch);
        autostartRow.activatable_widget = autostartSwitch;
        behaviorGroup.add(autostartRow);

        // Tray Icon Row
        const indicatorRow = new Adw.ActionRow({
            title: "Show Tray Icon",
            subtitle: "Display the icon in the top panel",
        });
        const indicatorSwitch = new Gtk.Switch({
            active: settings.get_boolean("show-indicator"),
            valign: Gtk.Align.CENTER,
        });
        settings.bind("show-indicator", indicatorSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        indicatorRow.add_suffix(indicatorSwitch);
        indicatorRow.activatable_widget = indicatorSwitch;
        behaviorGroup.add(indicatorRow);

        window.add(pageGeneral);
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