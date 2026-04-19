import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk"; // WICHTIG: Gdk importieren für prefs.js!

export function buildMultiScreenPage(settings, ext) {
    const page = new Adw.PreferencesPage({
        title: "Multi Screen",
        icon_name: "video-display-symbolic", // Optional: Ein passendes Icon
    });

    // Füge die Monitor-Gruppe zur Seite hinzu
    const monitorGroup = createMonitorGroup();
    page.add(monitorGroup);

    return page;
}

function createMonitorGroup() {
    // Erstelle eine Gruppe, die alle Monitor-Zeilen zusammenfasst
    const group = new Adw.PreferencesGroup({
        title: "Verfügbare Monitore",
        description: "Hier ist die aktuelle Anordnung deiner Bildschirme.",
    });

    // Monitore über Gdk abrufen (da 'global' in prefs.js nicht existiert)
    const display = Gdk.Display.get_default();
    const monitors = display.get_monitors();
    const numMonitors = monitors.get_n_items();

    for (let i = 0; i < numMonitors; i++) {
        const monitor = monitors.get_item(i);
        const geometry = monitor.get_geometry();

        // Den String für die Position und Auflösung bauen
        const positionString = `${geometry.width}x${geometry.height} bei Position (X: ${geometry.x}, Y: ${geometry.y})`;

        // Eine ActionRow für jeden Monitor erstellen
        const row = new Adw.ActionRow({
            title: `Monitor ${i + 1}`,
            subtitle: positionString,
        });

        // Die Zeile zur Gruppe hinzufügen
        group.add(row);
    }

    return group;
}
