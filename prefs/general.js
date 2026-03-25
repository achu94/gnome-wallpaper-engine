import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

export function buildGeneralPage(settings, ext) {
    const page = new Adw.PreferencesPage({
        title: "General",
        icon_name: "preferences-system-symbolic",
    });

    page.add(buildBehaviorGroup(settings));
    page.add(buildSupportGroup(ext));

    return page;
}

function buildBehaviorGroup(settings) {
    const group = new Adw.PreferencesGroup({
        title: "Behavior",
    });

    group.add(createSwitchRow(
        "Autostart",
        "Start wallpaper on login",
        settings,
        "autostart"
    ));

    group.add(createSwitchRow(
        "Tray Icon",
        "Show icon in the top panel",
        settings,
        "show-indicator"
    ));

    group.add(createSwitchRow(
        "Pause on Fullscreen",
        "Pause wallpaper when a fullscreen app is active",
        settings,
        "pause-on-fullscreen"
    ));

    group.add(createSwitchRow(
        "Pause on Battery",
        "Pause wallpaper when running on battery",
        settings,
        "pause-on-battery"
    ));

    return group;
}

function createSwitchRow(title, subtitle, settings, key) {
    const row = new Adw.ActionRow({ title, subtitle });

    const toggle = new Gtk.Switch({
        valign: Gtk.Align.CENTER,
    });

    settings.bind(key, toggle, "active", Gio.SettingsBindFlags.DEFAULT);

    row.add_suffix(toggle);
    row.activatable_widget = toggle;

    return row;
}

function buildSupportGroup(ext) {
    const group = new Adw.PreferencesGroup({
        title: "Support",
    });

    const row = new Adw.ActionRow({
        title: "Support development",
        subtitle: "If you like this project, consider supporting it",
    });

    const button = new Gtk.Button({
        label: "Donate",
        css_classes: ["suggested-action"],
        valign: Gtk.Align.CENTER,
    });

    const metadata = ext.metadata || {};
    const donateUrl = metadata.donate;

    button.connect("clicked", () => {
        Gio.AppInfo.launch_default_for_uri(donateUrl, null);
    });

    row.add_suffix(button);
    row.activatable_widget = button;

    group.add(row);

    return group;
}