import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { createWallpaperItem } from "./wallpaperItem.js";
import { ensureBackgroundsDir, getBackgroundsDir } from "../modules/utils.js";
import { ensureThumbnail } from "./importFiles.js";

export function buildGalleryPage(ext, window, settings) {
    const page = new Adw.PreferencesPage({
        title: "Gallery",
        icon_name: "folder-videos-symbolic",
    });

    const group = new Adw.PreferencesGroup({
        title: "Wallpaper Selection",
        description: "Select the wallpaper you wish to play",
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

    const refreshGallery = async () => {
        let child = flowBox.get_first_child();
        while (child) {
            flowBox.remove(child);
            child = flowBox.get_first_child();
        }

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

                const currentWallpaper = settings.get_string("current-wallpaper");
                if (
                    supported.some((ext) =>
                        fileName.toLowerCase().endsWith(ext),
                    )
                ) {
                    await ensureThumbnail(bgDir, fileName);
                    const isPlaying = currentWallpaper === fileName;
                    flowBox.append(createWallpaperItem(bgDir, fileName, isPlaying));
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    flowBox.connect("child-activated", (box, child) => {
        settings.set_string("current-wallpaper", child.get_child()._fullPath);
    });

    refreshGallery();

    // Watch for settings changes to refresh gallery when a new wallpaper is imported
    settings.connect("changed::current-wallpaper", () => {
        refreshGallery();
    });

    group.add(flowBox);
    page.add(group);

    return page;
}
