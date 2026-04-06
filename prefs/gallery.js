import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import GLib from "gi://GLib";

import { createWallpaperItem } from "./wallpaperItem.js";
import { ensureBackgroundsDir, getBackgroundsDir } from "../modules/utils.js";

function generateThumbnail(videoPath, thumbPath) {
    try {
        GLib.spawn_command_line_sync(
            `ffmpeg -y -ss 00:00:01 -i "${videoPath}" -frames:v 1 "${thumbPath}"`,
        );
    } catch (e) {
        logError(e);
    }
}

export function buildGalleryPage(ext, window, settings) {
    const page = new Adw.PreferencesPage({
        title: "Gallery",
        icon_name: "folder-videos-symbolic",
    });

    const group = new Adw.PreferencesGroup({
        title: "Wallpaper Selection",
        description: "Supported formats: MP4, WebM, MKV, MOV, AVI, GIF",
    });

    const addButton = new Gtk.Button({
        icon_name: "list-add-symbolic",
        valign: Gtk.Align.CENTER,
        css_classes: ["suggested-action", "pill"],
    });

    const openFolderButton = new Gtk.Button({
        icon_name: "folder-symbolic",
        valign: Gtk.Align.CENTER,
        css_classes: ["pill"],
    });

    const flowBox = new Gtk.FlowBox({
        valign: Gtk.Align.START,
        selection_mode: Gtk.SelectionMode.SINGLE,
        row_spacing: 4,
        column_spacing: 4,
    });

    const bgDir = getBackgroundsDir();
    const directory = ensureBackgroundsDir();

    const ensureThumbnail = async (fileName) => {
        const fullPath = `${bgDir}/${fileName}`;
        const baseName = fileName.substring(0, fileName.lastIndexOf("."));
        const thumbPath = `${bgDir}/${baseName}-thumb.webp`;

        const thumbFile = Gio.File.new_for_path(thumbPath);

        if (!thumbFile.query_exists(null)) {
            generateThumbnail(fullPath, thumbPath);
        }
    };

    const refreshGallery = () => {
        let child = flowBox.get_first_child();
        while (child) {
            flowBox.remove(child);
            child = flowBox.get_first_child();
        }

        ensureBackgroundsDir();

        try {
            const enumerator = directory.enumerate_children(
                "standard::name",
                Gio.FileQueryInfoFlags.NONE,
                null,
            );

            let info;
            const supported = [".mp4", ".webm", ".gif", ".mkv", ".mov", ".avi"];

            while ((info = enumerator.next_file(null)) !== null) {
                const fileName = info.get_name();

                if (
                    supported.some((ext) =>
                        fileName.toLowerCase().endsWith(ext),
                    )
                ) {
                    ensureThumbnail(fileName);
                    flowBox.append(createWallpaperItem(bgDir, fileName));
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    addButton.connect("clicked", async () => {
        const chooser = new Gtk.FileChooserNative({
            title: "Select Video or GIF",
            action: Gtk.FileChooserAction.OPEN,
            modal: true,
            transient_for: window,
        });

        const filter = new Gtk.FileFilter();
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
                const fileName = sourceFile.get_basename();

                const destPath = `${bgDir}/${fileName}`;
                const destFile = Gio.File.new_for_path(destPath);

                spinner.visible = true;
                spinner.start();

                sourceFile.copy_async(
                    destFile,
                    Gio.FileCopyFlags.OVERWRITE,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    null,
                    async (source, result) => {
                        try {
                            source.copy_finish(result);

                            spinner.stop();
                            spinner.visible = false;

                            await ensureThumbnail(fileName);
                            refreshGallery();

                            settings.set_string("current-wallpaper", "");
                            settings.set_string("current-wallpaper", fileName);
                        } catch (e) {
                            spinner.stop();
                            spinner.visible = false;
                            console.error(e);
                        }
                    },
                );
            }

            chooser.destroy();
        });

        chooser.show();
    });

    openFolderButton.connect("clicked", () => {
        const dir = Gio.File.new_for_path(bgDir);
        Gio.AppInfo.launch_default_for_uri(dir.get_uri(), null);
    });

    flowBox.connect("child-activated", (box, child) => {
        settings.set_string("current-wallpaper", child.get_child()._fullPath);
    });

    refreshGallery();

    const buttonBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_bottom: 12,
    });

    buttonBox.append(addButton);
    buttonBox.append(openFolderButton);

    const spinner = new Gtk.Spinner({
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        visible: false,
    });
    spinner.set_size_request(64, 64);
    spinner.set_halign(Gtk.Align.CENTER);

    group.add(buttonBox);
    group.add(spinner);
    group.add(flowBox);
    page.add(group);

    return page;
}
