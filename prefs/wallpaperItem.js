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

    // 👉 Thumbnail größer & schöner
    image.set_size_request(200, 120);

    if (image instanceof Gtk.Picture) {
        image.set_content_fit(Gtk.ContentFit.COVER);
    }

    // 👉 kleine abgerundete Ecken
    image.add_css_class("rounded");

    box.append(image);

    return box;
}