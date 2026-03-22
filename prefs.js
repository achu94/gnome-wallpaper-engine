import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

export default class WallpaperPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(
            "org.gnome.shell.extensions.gnome-wallpaper-engine"
        );

        const pageGallery = new Adw.PreferencesPage({
            title: "Gallery",
            icon_name: "folder-videos-symbolic",
        });

        const galleryGroup = new Adw.PreferencesGroup({
            title: "Wallpaper Selection",
            description: "Supported formats: MP4, WebM, MKV, MOV, AVI, GIF",
        });
        pageGallery.add(galleryGroup);

        const addButton = new Gtk.Button({
            label: "Add Video/GIF",
            icon_name: "list-add-symbolic",
            margin_bottom: 12,
            css_classes: ["suggested-action"],
        });

        const flowBox = new Gtk.FlowBox({
            valign: Gtk.Align.START,
            max_children_per_line: 3,
            min_children_per_line: 2,
            selection_mode: Gtk.SelectionMode.SINGLE,
            row_spacing: 12,
            column_spacing: 12,
        });

        const refreshGallery = () => {
            let child = flowBox.get_first_child();
            while (child) {
                flowBox.remove(child);
                child = flowBox.get_first_child();
            }

            const bgDir = `${this.path}/backgrounds`;
            const directory = Gio.File.new_for_path(bgDir);

            if (!directory.query_exists(null)) {
                try {
                    directory.make_directory_with_parents(null);
                } catch (e) {
                    console.error(e);
                    return;
                }
            }

            try {
                const enumerator = directory.enumerate_children(
                    "standard::name",
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                let info;
                const supported = [".mp4", ".webm", ".gif", ".mkv", ".mov", ".avi"];

                while ((info = enumerator.next_file(null)) !== null) {
                    const fileName = info.get_name();
                    if (supported.some(ext => fileName.toLowerCase().endsWith(ext))) {
                        flowBox.append(this._createWallpaperItem(bgDir, fileName));
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
                    const sourceFile = chooser.get_file();
                    const destPath = `${this.path}/backgrounds/${sourceFile.get_basename()}`;
                    const destFile = Gio.File.new_for_path(destPath);

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
            settings.set_string("current-wallpaper", child.get_child()._fullPath);
        });

        refreshGallery();
        galleryGroup.add(addButton);
        galleryGroup.add(flowBox);
        window.add(pageGallery);

        const pageGeneral = new Adw.PreferencesPage({
            title: "General",
            icon_name: "preferences-system-symbolic",
        });

        const behaviorGroup = new Adw.PreferencesGroup({
            title: "Behavior",
        });
        pageGeneral.add(behaviorGroup);

        const autostartRow = new Adw.ActionRow({
            title: "Autostart",
            subtitle: "Start wallpaper on login",
        });
        const autostartSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        settings.bind("autostart", autostartSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        autostartRow.add_suffix(autostartSwitch);
        autostartRow.activatable_widget = autostartSwitch;
        behaviorGroup.add(autostartRow);

        const indicatorRow = new Adw.ActionRow({
            title: "Tray Icon",
            subtitle: "Show icon in the top panel",
        });
        const indicatorSwitch = new Gtk.Switch({
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

        const lastDot = fileName.lastIndexOf(".");
        const baseName = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
        const thumbPath = `${dir}/${baseName}.jpg`;
        const thumbFile = Gio.File.new_for_path(thumbPath);

        let image;
        if (thumbFile.query_exists(null)) {
            image = Gtk.Picture.new_for_filename(thumbPath);
        } else {
            image = new Gtk.Image({
                icon_name: "video-x-generic-symbolic",
                pixel_size: 48,
            });
        }

        image.set_size_request(160, 90);
        if (image instanceof Gtk.Picture) {
            image.set_content_fit(Gtk.ContentFit.COVER);
        }

        const label = new Gtk.Label({
            label: baseName,
            max_width_chars: 12,
            ellipsize: 3,
            halign: Gtk.Align.CENTER,
        });

        box.append(image);
        box.append(label);
        return box;
    }
}