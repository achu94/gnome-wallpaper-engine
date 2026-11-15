// One tile in the video grid, styled like GNOME Settings' Background page:
// rounded thumbnail, accent outline when selected, round × to remove.
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { thumbPathFor } from "./library.js";

const TILE_WIDTH = 144;
const TILE_HEIGHT = 108;

const CSS = `
.gwe-tile { border-radius: 10px; padding: 3px; }
.gwe-tile.gwe-selected { box-shadow: inset 0 0 0 3px @accent_bg_color; }
.gwe-tile .gwe-thumb { border-radius: 8px; background-color: alpha(currentColor, 0.08); }
.gwe-tile .gwe-remove { min-width: 22px; min-height: 22px; padding: 0; margin: 6px; }
.gwe-grid { padding: 18px 12px; }
`;

let cssLoaded = false;
function ensureCss() {
    if (cssLoaded) return;
    const provider = new Gtk.CssProvider();
    provider.load_from_string?.(CSS) ?? provider.load_from_data(CSS, -1);
    Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    cssLoaded = true;
}

export function createWallpaperItem(fileName, { onRemove }) {
    ensureCss();

    const tile = new Gtk.Overlay({
        css_classes: ["gwe-tile"],
        halign: Gtk.Align.CENTER,
        tooltip_text: fileName,
    });
    tile._fullPath = fileName;

    // Rounded corners need the wrapper to clip its child.
    const frame = new Gtk.Box({ css_classes: ["gwe-thumb"], overflow: Gtk.Overflow.HIDDEN });
    const thumbPath = thumbPathFor(fileName);
    let image;
    if (Gio.File.new_for_path(thumbPath).query_exists(null)) {
        image = new Gtk.Picture({ content_fit: Gtk.ContentFit.COVER });
        image.set_filename(thumbPath);
    } else {
        image = new Gtk.Image({ icon_name: "video-x-generic-symbolic", pixel_size: 48, hexpand: true });
    }
    image.set_size_request(TILE_WIDTH, TILE_HEIGHT);
    frame.append(image);
    tile.set_child(frame);

    const remove = new Gtk.Button({
        icon_name: "window-close-symbolic",
        tooltip_text: "Move to Trash",
        halign: Gtk.Align.END,
        valign: Gtk.Align.START,
        css_classes: ["osd", "circular", "gwe-remove"],
    });
    remove.connect("clicked", () => onRemove(fileName));
    tile.add_overlay(remove);

    tile.setSelected = (selected) => {
        if (selected) tile.add_css_class("gwe-selected");
        else tile.remove_css_class("gwe-selected");
    };

    return tile;
}
