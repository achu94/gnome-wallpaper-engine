import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";

import { createWallpaperItem } from "./wallpaperItem.js";
import { buildScalingGroup, getMonitors, readConfig, writeMonitor } from "./displays.js";
import { createMonitorPickerGroup } from "./monitorPicker.js";
import { importFiles, listVideosInFolder, listWallpaperFiles, ensureThumbnail, thumbPathFor } from "./library.js";
import { forgetFile, resolveMonitor } from "../modules/monitorConfig.js";
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

    let onSelectionChanged = () => {};

    // --- Monitor picture, and the selected monitor's scaling ---
    const monitors = getMonitors();
    const { group: pickerGroup, picker } = createMonitorPickerGroup(settings, monitors, {
        onSelect: (connector) => {
            showScaling(connector);
            onSelectionChanged();
        },
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

    // --- Video grid, laid out like GNOME Settings' Background page ---
    const headerButton = (icon, label, tooltip) => new Gtk.Button({
        child: new Adw.ButtonContent({ icon_name: icon, label }),
        tooltip_text: tooltip,
        css_classes: ["flat"],
        valign: Gtk.Align.CENTER,
    });
    const addButton = headerButton("list-add-symbolic", "Add Video…", "Add a video or GIF");
    const addFolderButton = headerButton("folder-new-symbolic", "Add Folder…", "Add every video in a folder");
    const openFolderButton = new Gtk.Button({
        icon_name: "folder-open-symbolic",
        tooltip_text: "Open the wallpaper folder",
        css_classes: ["flat"],
        valign: Gtk.Align.CENTER,
    });
    const headerBox = new Gtk.Box({ spacing: 6 });
    [addButton, addFolderButton, openFolderButton].forEach((b) => headerBox.append(b));

    const group = new Adw.PreferencesGroup({
        title: "Videos",
        description: "MP4, WebM, MKV, MOV, AVI and GIF",
        header_suffix: headerBox,
    });

    const flowBox = new Gtk.FlowBox({
        valign: Gtk.Align.START,
        selection_mode: Gtk.SelectionMode.NONE,
        homogeneous: true,
        min_children_per_line: 3,
        max_children_per_line: 3,
        row_spacing: 12,
        column_spacing: 12,
        css_classes: ["gwe-grid"],
    });
    const card = new Gtk.Box({ css_classes: ["card"], orientation: Gtk.Orientation.VERTICAL });
    card.append(flowBox);

    const emptyLabel = new Gtk.Label({
        label: "No videos yet. Use Add Video… or Add Folder…",
        css_classes: ["dim-label"],
        margin_top: 24,
        margin_bottom: 24,
        visible: false,
    });
    card.append(emptyLabel);

    const bgDir = getBackgroundsDir();

    const spinner = new Gtk.Spinner({
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        visible: false,
    });
    spinner.set_size_request(32, 32);

    const statusLabel = new Gtk.Label({ visible: false, wrap: true, css_classes: ["dim-label"], margin_bottom: 6 });

    const setBusy = (busy, text = "") => {
        spinner.visible = busy;
        if (busy) spinner.start(); else spinner.stop();
        statusLabel.label = text;
        statusLabel.visible = text !== "";
        addButton.sensitive = !busy;
        addFolderButton.sensitive = !busy;
    };

    // The tile outlined in accent: the selected display's video (Unique) or
    // the shared one (Mirror).
    const tiles = new Map();
    const shownFile = () => {
        const mode = settings.get_string("wallpaper-mode");
        const defaultFile = settings.get_string("current-wallpaper");
        if (mode === "mirror") return defaultFile;
        return resolveMonitor(readConfig(settings), currentTarget(), defaultFile, mode).file;
    };
    const updateHighlight = () => {
        const file = shownFile();
        for (const [name, tile] of tiles) tile.setSelected(name === file);
    };
    onSelectionChanged = updateHighlight;
    const highlightIds = ["wallpaper-mode", "current-wallpaper", "monitor-config"].map((key) =>
        settings.connect(`changed::${key}`, updateHighlight));
    page.connect("destroy", () => highlightIds.forEach((id) => settings.disconnect(id)));

    // × on a tile: move the video and its thumbnail to the Trash (recoverable),
    // and point any display that used it back at the default.
    const removeVideo = async (fileName) => {
        try {
            Gio.File.new_for_path(`${bgDir}/${fileName}`).trash(null);
            try { Gio.File.new_for_path(thumbPathFor(fileName)).trash(null); } catch (_) { /* no thumb */ }
        } catch (e) {
            setBusy(false, `Could not move ${fileName} to the Trash: ${e.message}`);
            return;
        }
        settings.set_string("monitor-config", JSON.stringify(forgetFile(readConfig(settings), fileName)));
        if (settings.get_string("current-wallpaper") === fileName) {
            settings.set_string("current-wallpaper", "");
        }
        setBusy(false, `Moved ${fileName} to the Trash.`);
        await refreshGallery();
    };

    const refreshGallery = async () => {
        let child;
        while ((child = flowBox.get_first_child())) flowBox.remove(child);
        tiles.clear();
        const files = listWallpaperFiles();
        for (const fileName of files) {
            await ensureThumbnail(fileName);
            const tile = createWallpaperItem(fileName, { onRemove: removeVideo });
            tiles.set(fileName, tile);
            flowBox.append(tile);
        }
        flowBox.visible = files.length > 0;
        emptyLabel.visible = files.length === 0;
        updateHighlight();
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

    flowBox.connect("child-activated", (_box, child) => {
        applyWallpaper(settings, currentTarget(), child.get_child()._fullPath);
    });

    refreshGallery();

    group.add(statusLabel);
    group.add(spinner);
    group.add(card);
    page.add(group);

    return page;
}
