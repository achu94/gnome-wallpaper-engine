import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";

import { createWallpaperItem } from "./wallpaperItem.js";
import { buildScalingGroup, getMonitors, writeMonitor } from "./displays.js";
import { createMonitorPickerGroup } from "./monitorPicker.js";
import { importFiles, listVideosInFolder, listWallpaperFiles, ensureThumbnail } from "./library.js";
import { getBackgroundsDir } from "../modules/utils.js";

Gio._promisify(Gtk.FileDialog.prototype, "open", "open_finish");
Gio._promisify(Gtk.FileDialog.prototype, "select_folder", "select_folder_finish");

const VIDEO_MIME_TYPES = [
    "video/mp4", "video/webm", "image/gif", "video/x-matroska", "video/quicktime", "video/x-msvideo",
];

function isCancel(e) {
    return e instanceof GLib.Error && (
        e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED) ||
        e.matches(Gtk.DialogError, Gtk.DialogError.CANCELLED));
}


// Mirror: the clicked wallpaper goes on every display (the default).
// Unique: it goes on the selected display only.
function applyWallpaper(settings, connector, fileName) {
    if (settings.get_string("wallpaper-mode") === "mirror" || !connector) {
        settings.set_string("current-wallpaper", fileName);
    } else {
        writeMonitor(settings, connector, { file: fileName });
    }
}

export function buildGalleryPage(ext, window, settings, { onFilesChanged = () => {} } = {}) {
    const page = new Adw.PreferencesPage({
        title: "Gallery",
        icon_name: "folder-videos-symbolic",
    });

    // --- Monitor picture, and the selected monitor's scaling ---
    const monitors = getMonitors();
    const { group: pickerGroup, picker } = createMonitorPickerGroup(settings, monitors, {
        onSelect: (connector) => showScaling(connector),
    });
    page.add(pickerGroup);
    // One scaling group per monitor; only the selected monitor's is visible.
    const scalingGroups = new Map(monitors.map((m) => {
        const group = buildScalingGroup(settings, m);
        page.add(group);
        return [m.connector, group];
    }));
    const showScaling = (connector) => {
        for (const [c, group] of scalingGroups) group.visible = c === connector;
    };
    showScaling(picker.getSelected());
    const currentTarget = () => picker.getSelected();

    const group = new Adw.PreferencesGroup({
        title: "Wallpaper Selection",
        description: "Supported formats: MP4, WebM, MKV, MOV, AVI, GIF",
    });

    const addButton = new Gtk.Button({
        icon_name: "list-add-symbolic",
        tooltip_text: "Add a video",
        valign: Gtk.Align.CENTER,
        css_classes: ["suggested-action", "pill"],
    });

    const addFolderButton = new Gtk.Button({
        icon_name: "folder-new-symbolic",
        tooltip_text: "Add every video in a folder",
        valign: Gtk.Align.CENTER,
        css_classes: ["pill"],
    });

    const openFolderButton = new Gtk.Button({
        icon_name: "folder-symbolic",
        tooltip_text: "Open the wallpaper folder",
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

    const spinner = new Gtk.Spinner({
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        visible: false,
    });
    spinner.set_size_request(64, 64);

    const statusLabel = new Gtk.Label({ visible: false, wrap: true, css_classes: ["dim-label"] });

    const setBusy = (busy, text = "") => {
        spinner.visible = busy;
        if (busy) spinner.start(); else spinner.stop();
        statusLabel.label = text;
        statusLabel.visible = text !== "";
        addButton.sensitive = !busy;
        addFolderButton.sensitive = !busy;
    };

    const refreshGallery = async () => {
        let child = flowBox.get_first_child();
        while (child) {
            flowBox.remove(child);
            child = flowBox.get_first_child();
        }
        for (const fileName of listWallpaperFiles()) {
            await ensureThumbnail(fileName);
            flowBox.append(createWallpaperItem(bgDir, fileName));
        }
        picker.reload();
        onFilesChanged();
    };

    addButton.connect("clicked", async () => {
        const filter = new Gtk.FileFilter({ name: "Videos and GIFs" });
        VIDEO_MIME_TYPES.forEach((type) => filter.add_mime_type(type));
        const filters = new Gio.ListStore({ item_type: Gtk.FileFilter });
        filters.append(filter);
        const dialog = new Gtk.FileDialog({ title: "Select Video or GIF", modal: true, filters });

        let file;
        try {
            file = await dialog.open(window, null);
        } catch (e) {
            if (!isCancel(e)) console.error(e);
            return;
        }

        setBusy(true);
        const result = await importFiles([file]);
        setBusy(false);
        await refreshGallery();
        if (result.failed.length === 0) {
            applyWallpaper(settings, currentTarget(), file.get_basename());
        } else {
            setBusy(false, `Could not import ${file.get_basename()}.`);
        }
    });

    addFolderButton.connect("clicked", async () => {
        const dialog = new Gtk.FileDialog({ title: "Select a Folder of Videos", modal: true });

        let folder;
        try {
            folder = await dialog.select_folder(window, null);
        } catch (e) {
            if (!isCancel(e)) console.error(e);
            return;
        }

        setBusy(true, "Looking for videos…");
        try {
            const videos = await listVideosInFolder(folder);
            if (videos.length === 0) {
                setBusy(false, `No supported videos in ${folder.get_basename()}.`);
                return;
            }
            const result = await importFiles(videos, (i, total, name) =>
                setBusy(true, `Importing ${i} of ${total}: ${name}`));
            await refreshGallery();
            const parts = [`Added ${result.imported.length}`];
            if (result.skipped.length) parts.push(`${result.skipped.length} already there`);
            if (result.failed.length) parts.push(`${result.failed.length} failed: ${result.failed.join(", ")}`);
            setBusy(false, `${parts.join(", ")}.`);
        } catch (e) {
            console.error(e);
            setBusy(false, `Import failed: ${e.message}`);
        }
    });

    openFolderButton.connect("clicked", () => {
        const dir = Gio.File.new_for_path(bgDir);
        Gio.AppInfo.launch_default_for_uri(dir.get_uri(), null);
    });

    flowBox.connect("child-activated", (box, child) => {
        applyWallpaper(settings, currentTarget(), child.get_child()._fullPath);
    });

    refreshGallery();

    const buttonBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_bottom: 12,
    });

    buttonBox.append(addButton);
    buttonBox.append(addFolderButton);
    buttonBox.append(openFolderButton);

    group.add(buttonBox);
    group.add(spinner);
    group.add(statusLabel);
    group.add(flowBox);
    page.add(group);

    return page;
}
