import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";

import {
    FIT_LABELS,
    FIT_MODES,
    ZOOM_MAX,
    ZOOM_MIN,
    parseMonitorConfig,
    resolveMonitor,
    updateMonitor,
} from "../modules/monitorConfig.js";

const WRITE_DELAY_MS = 400;
const SLIDER_WIDTH = 280; // sliders: wait until the user stops dragging

// Connected monitors as [{ connector, name, number, x, y, width, height }].
export function getMonitors() {
    const list = Gdk.Display.get_default().get_monitors();
    const monitors = [];
    for (let i = 0; i < list.get_n_items(); i++) {
        const monitor = list.get_item(i);
        const { x, y, width, height } = monitor.get_geometry();
        const connector = monitor.get_connector() ?? `monitor-${i}`;
        const name = monitor.get_description?.()
            || [monitor.get_manufacturer(), monitor.get_model()].filter(Boolean).join(" ")
            || `Monitor ${i + 1}`;
        monitors.push({ connector, name, number: i + 1, x, y, width, height });
    }
    return monitors;
}

export function readConfig(settings) {
    return parseMonitorConfig(settings.get_string("monitor-config"));
}

export function writeMonitor(settings, connector, patch) {
    const config = updateMonitor(readConfig(settings), connector, patch);
    settings.set_string("monitor-config", JSON.stringify(config));
}

// Scaling, zoom and position for one monitor, shown under the monitor picture.
export function buildScalingGroup(settings, { connector, name, number, width, height }) {
    const group = new Adw.PreferencesGroup({
        title: `${number}  ${name}`,
        description: `${connector} · ${width}×${height}`,
    });

    const current = () =>
        resolveMonitor(readConfig(settings), connector, "");

    // --- Scaling ---
    const fitRow = new Adw.ComboRow({
        title: "Scaling",
        model: Gtk.StringList.new(FIT_MODES.map((mode) => FIT_LABELS[mode])),
        selected: FIT_MODES.indexOf(current().fit),
    });
    fitRow.connect("notify::selected", () =>
        writeMonitor(settings, connector, { fit: FIT_MODES[fitRow.selected] })
    );
    group.add(fitRow);

    // --- Zoom and position sliders ---
    const zoomScale = addSlider(group, settings, connector, {
        title: "Zoom",
        subtitle: "Below 100% shrinks, above 100% zooms in",
        key: "zoom",
        min: ZOOM_MIN * 100,
        max: ZOOM_MAX * 100,
        step: 5,
        value: current().zoom * 100,
        marks: [[100, null]],
        toSetting: (v) => Math.round(v) / 100,
        format: (v) => `${Math.round(v)}%`,
    });
    const alignXScale = addSlider(group, settings, connector, {
        title: "Horizontal position",
        subtitle: "Which part shows when the video is cropped or zoomed",
        key: "alignX",
        min: -100,
        max: 100,
        step: 5,
        value: current().alignX * 100,
        marks: [[-100, "Left"], [0, "Center"], [100, "Right"]],
        toSetting: (v) => Math.round(v) / 100,
        format: () => null,
    });
    const alignYScale = addSlider(group, settings, connector, {
        title: "Vertical position",
        key: "alignY",
        min: -100,
        max: 100,
        step: 5,
        value: current().alignY * 100,
        marks: [[-100, "Top"], [0, "Center"], [100, "Bottom"]],
        toSetting: (v) => Math.round(v) / 100,
        format: () => null,
    });

    // --- Reset ---
    const resetRow = new Adw.ActionRow({ title: "Reset scaling, zoom and position" });
    const resetButton = new Gtk.Button({ label: "Reset", valign: Gtk.Align.CENTER });
    resetButton.connect("clicked", () => {
        writeMonitor(settings, connector, { fit: "fill", zoom: 1, alignX: 0, alignY: 0 });
        fitRow.selected = 0;
        zoomScale.set_value(100);
        alignXScale.set_value(0);
        alignYScale.set_value(0);
    });
    resetRow.add_suffix(resetButton);
    group.add(resetRow);

    return group;
}

function addSlider(group, settings, connector, opts) {
    const row = new Adw.ActionRow({ title: opts.title, subtitle: opts.subtitle ?? "" });
    const scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, opts.min, opts.max, opts.step);
    scale.set_value(opts.value);
    scale.set_hexpand(false);
    scale.set_size_request(SLIDER_WIDTH, -1);
    scale.set_valign(Gtk.Align.CENTER);
    for (const [value, label] of opts.marks) {
        scale.add_mark(value, Gtk.PositionType.BOTTOM, label);
    }
    const label = opts.format(opts.value);
    scale.set_draw_value(label !== null);
    if (label !== null) {
        scale.set_value_pos(Gtk.PositionType.RIGHT);
        scale.set_format_value_func((_scale, value) => opts.format(value));
    }

    let timeoutId = null;
    const write = () => writeMonitor(settings, connector, { [opts.key]: opts.toSetting(scale.get_value()) });
    scale.connect("value-changed", () => {
        if (timeoutId) GLib.source_remove(timeoutId);
        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, WRITE_DELAY_MS, () => {
            timeoutId = null;
            write();
            return GLib.SOURCE_REMOVE;
        });
    });
    // Closing the window mid-drag still saves the last value.
    scale.connect("destroy", () => {
        if (!timeoutId) return;
        GLib.source_remove(timeoutId);
        timeoutId = null;
        write();
    });

    row.add_suffix(scale);
    group.add(row);
    return scale;
}
