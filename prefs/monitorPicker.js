// The GNOME-Settings-style picture of the monitors: Mirror/Unique switch on
// top, each monitor drawn at its real position with its wallpaper as a
// preview. Click a monitor to select it.
import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import GdkPixbuf from "gi://GdkPixbuf";
import Gtk from "gi://Gtk";

import { parseMonitorConfig, resolveMonitor } from "../modules/monitorConfig.js";
import { layoutMonitors, monitorAt } from "../modules/monitorLayout.js";
import { thumbPathFor } from "./library.js";

const AREA_HEIGHT = 200;
const PADDING = 20;
const GAP = 4;
const CORNER = 6;
const BADGE_RADIUS = 11;

// Where a video of imgW x imgH lands in a rect, mirroring the mpv options in
// buildScalingArgs (fill/fit/stretch/center, zoom, align).
function previewPlacement(rect, monitorWidth, imgW, imgH, { fit, zoom, alignX, alignY }) {
    let sx, sy;
    if (fit === "stretch") {
        sx = rect.width / imgW;
        sy = rect.height / imgH;
    } else {
        const cover = Math.max(rect.width / imgW, rect.height / imgH);
        const contain = Math.min(rect.width / imgW, rect.height / imgH);
        const original = rect.width / monitorWidth; // 1 video pixel = 1 screen pixel
        sx = sy = fit === "fill" ? cover : fit === "fit" ? contain : original;
    }
    sx *= zoom;
    sy *= zoom;
    const w = imgW * sx;
    const h = imgH * sy;
    return {
        x: rect.x + (rect.width - w) * (alignX + 1) / 2,
        y: rect.y + (rect.height - h) * (alignY + 1) / 2,
        sx,
        sy,
    };
}

function roundedRect(cr, { x, y, width, height }, r) {
    cr.newSubPath();
    cr.arc(x + width - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + width - r, y + height - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + height - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.closePath();
}

export function createMonitorPicker(settings, monitors, { onSelect = () => {} } = {}) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 });

    // --- Mirror / Unique ---
    const modeBox = new Gtk.Box({ halign: Gtk.Align.CENTER, css_classes: ["linked"] });
    const mirrorButton = new Gtk.ToggleButton({ label: "Mirror", tooltip_text: "Same video on every display" });
    const uniqueButton = new Gtk.ToggleButton({ label: "Unique", tooltip_text: "A different video on each display", group: mirrorButton });
    modeBox.append(mirrorButton);
    modeBox.append(uniqueButton);
    box.append(modeBox);

    const hint = new Gtk.Label({ css_classes: ["dim-label"], wrap: true });
    box.append(hint);

    // --- Monitor drawing ---
    let selected = monitors[0]?.connector ?? null;
    let rects = [];
    const pixbufs = new Map(); // file -> GdkPixbuf | null

    const loadPixbuf = (file) => {
        if (!file) return null;
        if (!pixbufs.has(file)) {
            try {
                pixbufs.set(file, GdkPixbuf.Pixbuf.new_from_file(thumbPathFor(file)));
            } catch (_) {
                pixbufs.set(file, null);
            }
        }
        return pixbufs.get(file);
    };

    const area = new Gtk.DrawingArea({ content_height: AREA_HEIGHT, hexpand: true, css_classes: ["card"] });
    const mode = () => settings.get_string("wallpaper-mode");

    area.set_draw_func((widget, cr, width, height) => {
        const accent = Adw.StyleManager.get_default().get_accent_color_rgba?.()
            ?? new Gdk.RGBA({ red: 0.21, green: 0.52, blue: 0.89, alpha: 1 });
        const fg = widget.get_color?.() ?? new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 });

        const config = parseMonitorConfig(settings.get_string("monitor-config"));
        const defaultFile = settings.get_string("current-wallpaper");
        rects = layoutMonitors(monitors, width, height, PADDING, GAP);

        rects.forEach((rect, i) => {
            const monitor = monitors[i];
            const resolved = resolveMonitor(config, monitor.connector, defaultFile, mode());
            const isSelected = monitor.connector === selected;

            // Background, then the wallpaper preview clipped to the monitor.
            cr.save();
            roundedRect(cr, rect, CORNER);
            cr.clip();
            cr.setSourceRGBA(0.1, 0.1, 0.11, 1);
            cr.paint();
            const pixbuf = loadPixbuf(resolved.file);
            if (pixbuf) {
                const p = previewPlacement(rect, monitor.width, pixbuf.get_width(), pixbuf.get_height(), resolved);
                cr.translate(p.x, p.y);
                cr.scale(p.sx, p.sy);
                Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
                cr.paint();
            }
            cr.restore();

            // Border: accent on the selected monitor.
            roundedRect(cr, rect, CORNER);
            if (isSelected) {
                cr.setSourceRGBA(accent.red, accent.green, accent.blue, 1);
                cr.setLineWidth(3);
            } else {
                cr.setSourceRGBA(fg.red, fg.green, fg.blue, 0.25);
                cr.setLineWidth(1);
            }
            cr.stroke();

            // Number badge, like GNOME's Displays settings.
            // Bottom-left corner so it doesn't cover the preview.
            const cx = rect.x + BADGE_RADIUS + 6;
            const cy = rect.y + rect.height - BADGE_RADIUS - 6;
            cr.arc(cx, cy, BADGE_RADIUS, 0, 2 * Math.PI);
            cr.setSourceRGBA(0.95, 0.95, 0.95, 0.9);
            cr.fill();
            cr.setSourceRGBA(0.1, 0.1, 0.1, 1);
            cr.selectFontFace("Sans", 0, 1);
            cr.setFontSize(13);
            const label = `${monitor.number}`;
            const ext = cr.textExtents(label);
            cr.moveTo(cx - ext.width / 2 - ext.xBearing, cy - ext.height / 2 - ext.yBearing);
            cr.showText(label);
        });
        cr.$dispose();
    });

    const click = new Gtk.GestureClick();
    click.connect("released", (_gesture, _n, x, y) => {
        const connector = monitorAt(rects, x, y);
        if (connector && connector !== selected) {
            selected = connector;
            area.queue_draw();
            onSelect(selected);
        }
    });
    area.add_controller(click);
    box.append(area);

    // --- Keep everything in sync with settings ---
    const updateMode = () => {
        const isMirror = mode() === "mirror";
        mirrorButton.active = isMirror;
        uniqueButton.active = !isMirror;
        hint.label = isMirror
            ? "Clicking a wallpaper puts it on every display. Select a display to change its scaling."
            : "Select a display, then click a wallpaper to put it on that display.";
        area.queue_draw();
    };
    mirrorButton.connect("toggled", () => {
        if (mirrorButton.active && mode() !== "mirror") settings.set_string("wallpaper-mode", "mirror");
    });
    uniqueButton.connect("toggled", () => {
        if (uniqueButton.active && mode() !== "unique") settings.set_string("wallpaper-mode", "unique");
    });

    const ids = [
        settings.connect("changed::wallpaper-mode", updateMode),
        settings.connect("changed::monitor-config", () => area.queue_draw()),
        settings.connect("changed::current-wallpaper", () => area.queue_draw()),
    ];
    box.connect("destroy", () => ids.forEach((id) => settings.disconnect(id)));
    updateMode();

    return {
        widget: box,
        getSelected: () => selected,
        // After an import replaced files, drop cached previews.
        reload: () => {
            pixbufs.clear();
            area.queue_draw();
        },
    };
}

// Group wrapper so the picker sits nicely on an Adw.PreferencesPage.
export function createMonitorPickerGroup(settings, monitors, opts) {
    const group = new Adw.PreferencesGroup();
    const picker = createMonitorPicker(settings, monitors, opts);
    group.add(picker.widget);
    return { group, picker };
}
