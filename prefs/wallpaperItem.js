import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

function getVideoMetadata(filePath) {
    const metadata = { resTag: null, duration: null, hasChapters: false };
    try {
        const [success, stdout] = GLib.spawn_command_line_sync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=height:format=duration -show_chapters -of json "${filePath}"`
        );
        if (success && stdout) {
            const data = JSON.parse(stdout.toString());
            const height = data.streams?.[0]?.height;
            const durationSeconds = parseFloat(data.format?.duration);
            const chapters = data.chapters || [];

            if (height) {
                if (height > 1080) metadata.resTag = "UHD";
                else if (height > 720) metadata.resTag = "HD";
                else metadata.resTag = "SD";
            }

            if (!isNaN(durationSeconds)) {
                const hours = Math.floor(durationSeconds / 3600);
                const minutes = Math.ceil((durationSeconds % 3600) / 60);
                
                if (hours > 0) {
                    metadata.duration = `${hours}:${minutes.toString().padStart(2, '0')}`;
                } else {
                    metadata.duration = `${minutes}m`;
                }
            }

            metadata.hasChapters = chapters.length > 0;
        }
    } catch (e) { }
    return metadata;
}

export function createWallpaperItem(dir, fileName, isPlaying = false) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.START,
    });

    box._fullPath = fileName;

    box.set_size_request(200, -1);

    box.add_css_class("card");
    box.add_css_class("activatable");

    const file = Gio.File.new_for_path(`${dir}/${fileName}`);
    const info = file.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null);
    const sizeInBytes = info.get_size();
    const sizeInGB = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2);
    const sizeStr = sizeInBytes > 1024 * 1024 * 1024 
        ? `${sizeInGB} GB` 
        : `${Math.round(sizeInBytes / (1024 * 1024))} MB`;
    
    const extension = fileName.split('.').pop().toUpperCase();
    const metadata = getVideoMetadata(`${dir}/${fileName}`);
    const lastDot = fileName.lastIndexOf(".");
    const baseName = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;

    const thumbPath = `${dir}/${baseName}-thumb.jpg`;
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

    image.set_size_request(200, 120);

    if (image instanceof Gtk.Picture) {
        image.set_content_fit(Gtk.ContentFit.COVER);
    }

    image.add_css_class("rounded");

    const overlay = new Gtk.Overlay();
    overlay.set_child(image);

    const label = new Gtk.Label({
        label: baseName,
        halign: Gtk.Align.START,
        valign: Gtk.Align.END,
        margin_start: 5,
        margin_bottom: 5,
    });
    label.add_css_class("wallpaper-label");

    const tagsBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 4,
        halign: Gtk.Align.END,
        valign: Gtk.Align.START,
        margin_top: 5,
        margin_end: 5,
    });

    const metaLabel = new Gtk.Label({ label: metadata.hasChapters ? "META" : "SINGLE" });
    metaLabel.add_css_class("wallpaper-tag");
    tagsBox.append(metaLabel);

    if (metadata.duration) {
        const durationLabel = new Gtk.Label({ label: metadata.duration });
        durationLabel.add_css_class("wallpaper-tag");
        tagsBox.append(durationLabel);
    }

    const sizeLabel = new Gtk.Label({ label: sizeStr });
    sizeLabel.add_css_class("wallpaper-tag");
    tagsBox.append(sizeLabel);

    if (metadata.resTag) {
        const resLabel = new Gtk.Label({ label: metadata.resTag });
        resLabel.add_css_class("wallpaper-tag");
        tagsBox.append(resLabel);
    }

    const extLabel = new Gtk.Label({ label: extension });
    extLabel.add_css_class("wallpaper-tag");
    tagsBox.append(extLabel);

    overlay.add_overlay(label);
    overlay.add_overlay(tagsBox);

    if (isPlaying) {
        const playingLabel = new Gtk.Label({
            label: "PLAYING",
            halign: Gtk.Align.START,
            valign: Gtk.Align.START,
            margin_start: 5,
            margin_top: 5,
        });
        playingLabel.add_css_class("playing-tag");
        overlay.add_overlay(playingLabel);
    }

    box.append(overlay);

    return box;
}