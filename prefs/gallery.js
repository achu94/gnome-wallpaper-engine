import Adw from "gi://Adw?version=1";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";

import { createWallpaperItem } from "./wallpaperItem.js";
import { MediaCatalogService } from "../modules/media/mediaCatalogService.js";
import { ThumbnailService } from "../modules/media/thumbnailService.js";
import {
    getSupportedFormatDescription,
    getSupportedMimeTypes,
} from "../modules/media/mediaTypes.js";

export function buildGalleryPage(ext, window, settings) {
    void ext;

    const mediaCatalog = new MediaCatalogService();
    const thumbnailService = new ThumbnailService(mediaCatalog);

    const page = new Adw.PreferencesPage({
        title: "Gallery",
        icon_name: "folder-videos-symbolic",
    });

    const group = new Adw.PreferencesGroup({
        title: "Wallpaper Selection",
        description: `Supported formats: ${getSupportedFormatDescription()}`,
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

    const spinner = new Gtk.Spinner({
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        visible: false,
    });
    spinner.set_size_request(64, 64);

    const healthLabel = new Gtk.Label({
        xalign: 0,
        wrap: true,
        selectable: true,
    });
    healthLabel.add_css_class("dim-label");

    let refreshRunId = 0;

    const setBusy = (isBusy) => {
        spinner.visible = isBusy;
        addButton.sensitive = !isBusy;
        openFolderButton.sensitive = !isBusy;

        if (isBusy) {
            spinner.start();
        } else {
            spinner.stop();
        }
    };

    const refreshGallery = async () => {
        const currentRunId = ++refreshRunId;
        setBusy(true);
        clearFlowBox(flowBox);

        const currentWallpaper = settings.get_string("current-wallpaper");
        const renderedItems = [];

        try {
            const mediaItems = mediaCatalog.listItems();

            for (const mediaItem of mediaItems) {
                if (currentRunId !== refreshRunId) {
                    return;
                }

                const thumbnailStatus = await thumbnailService.ensureThumbnail(mediaItem);
                renderedItems.push({ mediaItem, thumbnailStatus });
            }

            if (currentRunId !== refreshRunId) {
                return;
            }

            for (const renderedItem of renderedItems) {
                const card = createWallpaperItem(
                    renderedItem.mediaItem,
                    renderedItem.thumbnailStatus,
                );
                flowBox.append(card);
            }

            selectCurrentWallpaperCard(flowBox, currentWallpaper);
            updateHealthSummary(healthLabel, renderedItems);
        } catch (e) {
            logError(e);
            healthLabel.set_label("Unable to refresh media catalog.");
        } finally {
            if (currentRunId === refreshRunId) {
                setBusy(false);
            }
        }
    };

    addButton.connect("clicked", () => {
        const chooser = new Gtk.FileChooserNative({
            title: "Select Video or Image",
            action: Gtk.FileChooserAction.OPEN,
            modal: true,
            transient_for: window,
        });

        const filter = new Gtk.FileFilter();
        filter.set_name("Supported media files");

        for (const mimeType of getSupportedMimeTypes()) {
            filter.add_mime_type(mimeType);
        }

        filter.add_pattern("*.mp4");
        filter.add_pattern("*.webm");
        filter.add_pattern("*.mkv");
        filter.add_pattern("*.mov");
        filter.add_pattern("*.avi");
        filter.add_pattern("*.gif");
        filter.add_pattern("*.jpg");
        filter.add_pattern("*.jpeg");
        filter.add_pattern("*.png");
        filter.add_pattern("*.webp");
        filter.add_pattern("*.bmp");
        filter.add_pattern("*.tif");
        filter.add_pattern("*.tiff");

        chooser.add_filter(filter);

        chooser.connect("response", async (_chooser, response_id) => {
            if (response_id === Gtk.ResponseType.ACCEPT) {
                const sourceFile = chooser.get_file();
                if (!sourceFile) {
                    chooser.destroy();
                    return;
                }

                setBusy(true);
                try {
                    const importedItem = await mediaCatalog.importMedia(sourceFile);
                    await thumbnailService.ensureThumbnail(importedItem);
                    await refreshGallery();
                    setCurrentWallpaper(settings, importedItem.fileName);
                } catch (e) {
                    logError(e);
                    healthLabel.set_label(`Import failed: ${e.message}`);
                } finally {
                    setBusy(false);
                }
            }

            chooser.destroy();
        });

        chooser.show();
    });

    openFolderButton.connect("clicked", () => {
        const dir = Gio.File.new_for_path(mediaCatalog.getBackgroundsDirPath());
        Gio.AppInfo.launch_default_for_uri(dir.get_uri(), null);
    });

    flowBox.connect("child-activated", (box, child) => {
        const card = child?.get_child?.();
        if (!card?._fileName) {
            return;
        }

        setCurrentWallpaper(settings, card._fileName);
    });

    refreshGallery();

    const buttonBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_bottom: 12,
    });

    buttonBox.append(addButton);
    buttonBox.append(openFolderButton);

    group.add(buttonBox);
    group.add(healthLabel);
    group.add(spinner);
    group.add(flowBox);
    page.add(group);

    return page;
}

function clearFlowBox(flowBox) {
    let child = flowBox.get_first_child();

    while (child) {
        flowBox.remove(child);
        child = flowBox.get_first_child();
    }
}

function setCurrentWallpaper(settings, fileName) {
    const currentWallpaper = settings.get_string("current-wallpaper");

    if (currentWallpaper === fileName) {
        settings.set_string("current-wallpaper", "");
    }

    settings.set_string("current-wallpaper", fileName);
}

function selectCurrentWallpaperCard(flowBox, currentWallpaper) {
    let child = flowBox.get_first_child();

    while (child) {
        const card = child?.get_child?.();
        if (card?._fileName === currentWallpaper) {
            flowBox.select_child(child);
            return;
        }

        child = child.get_next_sibling();
    }
}

function updateHealthSummary(label, renderedItems) {
    if (!renderedItems.length) {
        label.set_label("No media imported yet. Use + to add videos or static images.");
        return;
    }

    let readyCount = 0;
    let fallbackCount = 0;
    let issueCount = 0;

    for (const { thumbnailStatus } of renderedItems) {
        const status = thumbnailStatus?.status || "unknown";

        if (status === "ready") {
            readyCount += 1;
            continue;
        }

        if (status === "fallback") {
            fallbackCount += 1;
            continue;
        }

        issueCount += 1;
    }

    label.set_label(
        `${renderedItems.length} items · `
        + `${readyCount} healthy · `
        + `${fallbackCount} fallback · `
        + `${issueCount} with issues`,
    );
}
