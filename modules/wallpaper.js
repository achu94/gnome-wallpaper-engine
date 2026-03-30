import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Cairo from "gi://cairo";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import Clutter from "gi://Clutter";

import { WindowUtils } from "./windowUtils.js";

export class Wallpaper {
    constructor(ext, windowFilter) {
        debug("Wallpaper: constructor() initialisiert");
        this._ext = ext;
        this._windowFilter = windowFilter;

        this._mpvProcess = null;

        this._wallpaperWindow = null;
        this._raisedSignalId = null;
        this._windowCreatedId = null;
        this._lowerFixApplied = false;
        this._clone = null;
    }

    clone(metaWindow) {
        debug(`Wallpaper: clone() aufgerufen für Fenster: ${metaWindow ? metaWindow.get_title() : 'null'}`);
        try {
            let actor = metaWindow.get_compositor_private();
            if (!actor) {
                debug("Wallpaper: Kein compositor_private (actor) gefunden! Abbruch clone().");
                return null;
            }

            const clutterClone = new Clutter.Clone({
                source: actor,
            });

            let monitor = Main.layoutManager.primaryMonitor;
            debug(`Wallpaper: Primärer Monitor erkannt - Position: ${monitor.x},${monitor.y}, Größe: ${monitor.width}x${monitor.height}`);

            clutterClone.set_position(monitor.x, monitor.y);
            clutterClone.set_size(monitor.width, monitor.height);
            clutterClone.set_lower();

            Main.layoutManager._backgroundGroup.add_child(clutterClone);
            debug("Wallpaper: Clutter.Clone erfolgreich zur _backgroundGroup hinzugefügt.");

            actor.opacity = 0;
            actor.set_reactive(false);

            metaWindow.move_frame(true, -10000, -10000);
            metaWindow.stick();
            debug("Wallpaper: Original-Fenster versteckt und angepinnt (stick).");

            return clutterClone;

        } catch (error) {
            debug(`Wallpaper: FEHLER in clone(): ${error}`);
        }
    }

    start() {
        debug("Wallpaper: start() aufgerufen, rufe stop() zur Sicherheit auf...");
        this.stop();

        const settings = this._ext._settings;
        const filename = settings.get_string("current-wallpaper");

        debug(`Wallpaper: Gelesener Dateiname aus den Settings: "${filename}"`);
        if (!filename) {
            debug("Wallpaper: Kein Dateiname vorhanden. start() wird abgebrochen.");
            return;
        }

        const videoPath = GLib.build_filenamev([
            this._ext.path,
            "backgrounds",
            filename,
        ]);
        debug(`Wallpaper: Generierter Video-Pfad: ${videoPath}`);

        const cmd = [
            "mpv",
            "--no-border",
            "--loop=inf",
            "--no-audio",
            "--force-window=immediate",
            "--ontop=no",
            "--keep-open=yes",
            "--geometry=100%x100%",
            "--no-osc",
            "--no-osd-bar",
            "--title=wallpaper_bg",
            "--x11-name=wallpaper_bg",
            "--panscan=1.0",
            "--video-unscaled=no",
            "--input-default-bindings=no",
            "--input-vo-keyboard=no",
            "--cursor-autohide=no",
            "--hwdec=auto",
            videoPath,
        ];

        try {
            debug(`Wallpaper: Starte mpv Prozess mit Befehl: ${cmd.join(" ")}`);
            this._mpvProcess = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
            debug("Wallpaper: mpv Subprocess erfolgreich gestartet.");

            this._windowCreatedId = global.display.connect(
                "window-created",
                (_, metaWin) => {
                    debug(`Wallpaper: Signal 'window-created' gefeuert für: ${metaWin}`);
                    this._handleWindow(metaWin);
                }
            );
            debug(`Wallpaper: 'window-created' Signal verbunden (ID: ${this._windowCreatedId}).`);

            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                const actors = global.get_window_actors();
                debug(`Wallpaper: Durchsuche ${actors.length} existierende Fenster-Actors im idle_add...`);
                for (const actor of actors) {
                    this._handleWindow(actor.get_meta_window());
                }
                return GLib.SOURCE_REMOVE;
            });

        } catch (e) {
            debug(`Wallpaper: FEHLER in start(): ${e}`);
            logError(e);
        }
    }

    _handleWindow(metaWin) {
        if (!metaWin) return;

        // Wir geben Mutter/GJS einen kurzen Moment (100ms), 
        // um die Fenstereigenschaften (Titel, Class, Actor) zu laden.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {

            // Erst jetzt prüfen wir, ob es das richtige Fenster ist
            if (!WindowUtils.isWallpaperWindow(metaWin)) {
                return GLib.SOURCE_REMOVE; // Beende den Timeout, nicht unser Fenster
            }

            const title = metaWin.get_title();
            debug(`Wallpaper: Wallpaper-Fenster erkannt! ("${title}") Wende Fenstereinstellungen an...`);

            // 1. Fenster im Filter registrieren
            if (this._windowFilter) {
                this._windowFilter.addWindow(metaWin);
            }

            // 2. Grundlegende Fenster-Eigenschaften
            metaWin.lower();
            metaWin.stick();
            metaWin.focus_on_click = false;

            try {
                metaWin.set_accept_focus(false);
            } catch (e) {
                debug(`Wallpaper: Fehler bei set_accept_focus: ${e}`);
            }

            // 3. Input Region entfernen (Klicks gehen durch das Fenster durch)
            // Wir nutzen ein idle_add, um sicherzustellen, dass der Actor existiert
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                try {
                    metaWin.set_input_region(new Cairo.Region()); // Sicherer als null bei manchen Versionen
                    debug("Wallpaper: Input-Region erfolgreich entfernt.");
                } catch (e) {
                    debug(`Wallpaper: Fehler bei set_input_region: ${e}`);
                }
                return GLib.SOURCE_REMOVE;
            });

            // 4. Den "Dauerhaft-Unten"-Fix anwenden
            if (!this._lowerFixApplied) {
                this._lowerFixApplied = true;
                let count = 0;
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                    if (metaWin) metaWin.lower();
                    count++;
                    return count < 5;
                });
            }

            // 5. Clonen für die Optik (BackgroundGroup)
            if (!this._clone) {
                // Wichtig: Wir müssen warten, bis der Actor (compositor_private) da ist!
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    if (metaWin.get_compositor_private()) {
                        this._clone = this.clone(metaWin);
                    } else {
                        debug("Wallpaper: Actor noch nicht bereit für Clone, versuche es gleich erneut...");
                        return GLib.SOURCE_CONTINUE;
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }

            // 6. Signal-Handling (Raised-Prävention)
            if (!this._wallpaperWindow) {
                this._wallpaperWindow = metaWin;
                this._raisedSignalId = metaWin.connect("raised", () => {
                    debug("Wallpaper: 'raised' Signal abgefangen -> lower()");
                    metaWin.lower();
                });
            }

            return GLib.SOURCE_REMOVE; // Timeout beenden
        });
    }

    stop() {
        debug("Wallpaper: stop() aufgerufen. Starte Cleanup...");

        if (this._mpvProcess) {
            debug("Wallpaper: Beende mpv Prozess...");
            this._mpvProcess.force_exit();
            this._mpvProcess = null;
        }

        if (this._windowCreatedId) {
            debug("Wallpaper: Trenne 'window-created' Signal...");
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._raisedSignalId && this._wallpaperWindow) {
            debug("Wallpaper: Trenne 'raised' Signal vom Wallpaper-Fenster...");
            this._wallpaperWindow.disconnect(this._raisedSignalId);
            this._raisedSignalId = null;
        }

        if (this._wallpaperWindow) {
            debug("Wallpaper: Entferne Fenster aus windowFilter...");
            this._windowFilter.removeWindow(this._wallpaperWindow);
        }

        if (this._clone) {
            debug("Wallpaper: Zerstöre Clutter.Clone...");
            this._clone.destroy();
            this._clone = null;
        }

        this._wallpaperWindow = null;
        this._lowerFixApplied = false;
        debug("Wallpaper: Cleanup abgeschlossen.");
    }
}