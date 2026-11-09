import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { importWallpaper, downloadYoutubeVideo } from "./importFiles.js";
import { getBackgroundsDir } from "../modules/utils.js";

export function buildGeneralPage(settings, ext, window) {
    const page = new Adw.PreferencesPage({
        title: "General",
        icon_name: "preferences-system-symbolic",
    });

    page.add(buildBehaviorGroup(settings));
    page.add(buildMediaPage(settings, window));
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
        "Play Audio",
        "Play audio when the wallpaper is active",
        settings,
        "play-audio"
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

function buildMediaPage(settings, window) {
    const group = new Adw.PreferencesGroup({
        title: "Media",
        description: "Import videos or GIFs to use as wallpapers",
    });

    const bgDir = getBackgroundsDir();

    // Local Import Section
    const addButton = new Gtk.Button({
        label: "Add",
        valign: Gtk.Align.CENTER,
        css_classes: ["suggested-action"],
    });

    const openFolderButton = new Gtk.Button({
        label: "Open Folder",
        valign: Gtk.Align.CENTER,
    });

    const spinner = new Gtk.Spinner({
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        visible: false,
        margin_end: 12,
    });

    const row = new Adw.ActionRow({
        title: "Import Media",
        subtitle: "Supported formats: MP4, WebM, MKV, MOV, AVI, GIF",
    });
    row.add_suffix(spinner);
    row.add_suffix(openFolderButton);
    row.add_suffix(addButton);

    openFolderButton.connect("clicked", () => {
        const dir = Gio.File.new_for_path(bgDir);
        Gio.AppInfo.launch_default_for_uri(dir.get_uri(), null);
    });

    addButton.connect("clicked", () => {
        const chooser = new Gtk.FileChooserNative({
            title: "Select Video or GIF",
            action: Gtk.FileChooserAction.OPEN,
            modal: true,
            transient_for: window,
        });

        const filter = new Gtk.FileFilter();
        filter.add_mime_type("video/mp4");
        filter.add_mime_type("video/webm");
        filter.add_mime_type("image/gif");
        filter.add_mime_type("video/x-matroska");
        filter.add_mime_type("video/quicktime");
        filter.add_mime_type("video/x-msvideo");
        chooser.add_filter(filter);

        chooser.connect("response", async (res, response_id) => {
            if (response_id === Gtk.ResponseType.ACCEPT) {
                const sourceFile = chooser.get_file();

                spinner.visible = true;
                spinner.start();

                try {
                    const fileName = await importWallpaper(sourceFile, bgDir);

                    spinner.stop();
                    spinner.visible = false;

                    settings.set_string("current-wallpaper", fileName);
                } catch (e) {
                    spinner.stop();
                    spinner.visible = false;
                    console.error(e);
                }
            }
            chooser.destroy();
        });

        chooser.show();
    });

    group.add(row);

    // YouTube import section
    const ytRow = new Adw.ActionRow({
        title: "Import YouTube",
        subtitle: "Paste YouTube (URL)",
    });
    // Spinner to show import in progress
    const ytSpinner = new Gtk.Spinner({
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        visible: false,
        margin_end: 12,
    });
    // Entry box to paste youtube link
    const ytEntry = new Gtk.Entry({
        placeholder_text: "https://youtu.be/...",
        hexpand: true,
        valign: Gtk.Align.CENTER,
    });

    // dropdown combonation box
    const qualityCombo = new Gtk.ComboBoxText({
        valign: Gtk.Align.CENTER,
    });
    qualityCombo.add_css_class("flat");
    qualityCombo.append("UHD", "UHD");
    qualityCombo.append("HD", "HD");
    qualityCombo.append("SD", "SD");
    settings.bind("youtube-quality", qualityCombo, "active-id", Gio.SettingsBindFlags.DEFAULT);

    // Add btn
    const ytApplyButton = new Gtk.Button({
        label: "Add",
        valign: Gtk.Align.CENTER,
        css_classes: ["suggested-action"],
    });

    // Order of rendering the row.
    ytRow.add_suffix(ytSpinner);
    ytRow.add_suffix(ytEntry);
    ytRow.add_suffix(qualityCombo);
    ytRow.add_suffix(ytApplyButton);

    ytApplyButton.connect("clicked", async () => {
        const url = ytEntry.text.trim();
        if (!url) return;

        ytSpinner.visible = true;
        ytSpinner.start();
        ytApplyButton.sensitive = false;
        ytEntry.sensitive = false;

        let fileName;
        try {
            const quality = qualityCombo.get_active_id();
            const stream = settings.get_boolean("youtube-stream");
            fileName = await downloadYoutubeVideo(url, bgDir, quality, stream);
        } catch (e) {
            ytEntry.text = "URL Invalid";
        } finally {
            ytSpinner.stop();
            ytSpinner.visible = false;
            ytApplyButton.sensitive = true;
            ytEntry.sensitive = true;
            if (fileName) {
                ytEntry.text = '';
                settings.set_string("current-wallpaper", fileName);
            }
        }
    });

    group.add(ytRow);

    group.add(createSwitchRow(
        "Stream YouTube",
        "Enable to create a streaming link, instead of downloading the mp4",
        settings,
        "youtube-stream"
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
