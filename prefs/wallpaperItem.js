import Gio from "gi://Gio";
import Gtk from "gi://Gtk?version=4.0";

import { getMediaTypeLabel } from "../modules/media/mediaTypes.js";

export function createWallpaperItem(mediaItem, thumbnailStatus) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        halign: Gtk.Align.FILL,
        valign: Gtk.Align.START,
        spacing: 8,
        margin_top: 6,
        margin_bottom: 6,
        margin_start: 6,
        margin_end: 6,
    });

    box._fileName = mediaItem.fileName;
    box._mediaId = mediaItem.id;

    box.set_size_request(230, -1);

    box.add_css_class("card");
    box.add_css_class("activatable");

    const image = buildPreview(mediaItem, thumbnailStatus);
    image.set_size_request(200, 120);

    if (image instanceof Gtk.Picture) {
        image.set_content_fit(Gtk.ContentFit.COVER);
    }

    image.add_css_class("rounded");
    box.append(image);

    const fileNameLabel = new Gtk.Label({
        label: mediaItem.fileName,
        wrap: true,
        max_width_chars: 28,
        xalign: 0,
    });
    fileNameLabel.add_css_class("heading");
    box.append(fileNameLabel);

    const metadataLabel = new Gtk.Label({
        label: `${getMediaTypeLabel(mediaItem.mediaType)}`,
        xalign: 0,
    });
    metadataLabel.add_css_class("dim-label");
    box.append(metadataLabel);

    const statusBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        halign: Gtk.Align.START,
    });

    const statusIcon = new Gtk.Image({
        icon_name: getStatusIconName(thumbnailStatus?.status),
        pixel_size: 14,
    });
    statusBox.append(statusIcon);

    const statusLabel = new Gtk.Label({
        label: getStatusLabel(thumbnailStatus),
        wrap: true,
        max_width_chars: 30,
        xalign: 0,
    });
    statusLabel.add_css_class("caption");
    statusBox.append(statusLabel);

    box.append(statusBox);

    return box;
}

function buildPreview(mediaItem, thumbnailStatus) {
    const thumbnailPath = thumbnailStatus?.thumbnailPath || "";

    if (thumbnailPath) {
        const thumbFile = Gio.File.new_for_path(thumbnailPath);
        if (thumbFile.query_exists(null)) {
            return Gtk.Picture.new_for_filename(thumbnailPath);
        }
    }

    const fallbackIcon = mediaItem.mediaType === "image"
        ? "image-x-generic-symbolic"
        : "video-x-generic-symbolic";

    return new Gtk.Image({
        icon_name: fallbackIcon,
        pixel_size: 48,
    });
}

function getStatusLabel(thumbnailStatus) {
    const status = thumbnailStatus?.status || "unknown";

    if (status === "ready") {
        return "Thumbnail healthy";
    }

    if (status === "fallback") {
        return "Thumbnail generated with fallback";
    }

    if (status === "missing-source") {
        return "Source file missing";
    }

    if (status === "failed") {
        return thumbnailStatus?.error || "Thumbnail generation failed";
    }

    return "Thumbnail pending";
}

function getStatusIconName(status) {
    if (status === "ready") {
        return "emblem-ok-symbolic";
    }

    if (status === "fallback") {
        return "dialog-warning-symbolic";
    }

    if (status === "failed" || status === "missing-source") {
        return "dialog-error-symbolic";
    }

    return "dialog-information-symbolic";
}
