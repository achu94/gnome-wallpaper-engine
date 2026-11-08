import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

export function createWallpaperItem(dir, fileName) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.START,
    });

    box._fullPath = fileName;

    box.set_size_request(200, -1);

    box.add_css_class("card");
    box.add_css_class("activatable");

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

    overlay.add_overlay(label);
    box.append(overlay);

    return box;
}