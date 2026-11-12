import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";

import { mediaFormat } from "../modules/ytWallpaper.js";

export function getVideoMetadata(filePath) {
    const metadata = { resTag: "", codec: "", duration: null, hasChapters: false };

    try {
        let height = 0;
        let rawCodec = "";
        let durationSeconds = NaN;
        let hasChapters = false;

        if (filePath.toLowerCase().endsWith(".m3u")) {
          const jsonString = mediaFormat(filePath, filePath, false);
          const m3uData = JSON.parse(jsonString);

          height = parseInt(m3uData.format, 10) || 0;
          rawCodec = m3uData.codec ? m3uData.codec.toLowerCase() : "";
          durationSeconds = parseFloat(m3uData.length);
          hasChapters = m3uData.hasChapters;

        } else {
            const [success, stdout] = GLib.spawn_command_line_sync(
                `ffprobe -v error -select_streams v:0 -show_entries stream=height,codec_name:format=duration -show_chapters -of json "${filePath}"`
            );
            if (success && stdout) {
                const data = JSON.parse(stdout.toString());
                const stream = data.streams?.[0] || {};
                height = stream.height || 0;
                rawCodec = stream.codec_name ? stream.codec_name.toLowerCase() : "";
                durationSeconds = parseFloat(data.format?.duration);
                hasChapters = (data.chapters || []).length > 0;
            }
        }

        // Resolution mapping
        if (height > 1440) metadata.resTag = "UHD";
        else if (height > 1080) metadata.resTag = "QHD";
        else if (height > 720) metadata.resTag = "HD";
        else metadata.resTag = "SD";

        // Codec mapping
        if (rawCodec === "av01") metadata.codec = "AV1";
        else if (rawCodec === "vp09") metadata.codec = "VP9";
        else if (rawCodec === "avc1" || rawCodec === "h264") metadata.codec = "H264";
        else if (rawCodec) metadata.codec = rawCodec.toUpperCase();

        // Duration formatting
        if (!isNaN(durationSeconds)) {
            const hours = Math.floor(durationSeconds / 3600);
            const minutes = Math.ceil((durationSeconds % 3600) / 60);
            metadata.duration = hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${minutes}m`;
        }

        metadata.hasChapters = hasChapters;

    } catch (e) { }

    return metadata;
}

export function createMediaBadge(label, options = {}) {
  const {
    bgColor = '#1E293B',
    textColor = '#FFFFFF',
    borderColor = '#1E293B',
    height = 20
  } = options;

  const text = label.toUpperCase();
  const width = Math.max(32, text.length * 8 + 12);

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="4"
            fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
            fill="${textColor}" font-family="system-ui, -apple-system, sans-serif"
            font-size="10" font-weight="700" letter-spacing="0.5">
        ${text}
      </text>
    </svg>
  `.trim();

  const bytes = new GLib.Bytes(new TextEncoder().encode(svgString));
  const texture = Gdk.Texture.new_from_bytes(bytes);
  const picture = Gtk.Picture.new_for_paintable(texture);

  picture.set_can_shrink(false);
  picture.set_halign(Gtk.Align.END);
  picture.set_valign(Gtk.Align.CENTER);

  return picture;
}

export function createWallpaperItem(dir, fileName, isInstalled = false) {
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
        : sizeInBytes < 1024 * 1024
        ? "STREAM"
        : `${Math.round(sizeInBytes / (1024 * 1024))} MB`;

    const extension = fileName.split('.').pop().toUpperCase();
    const lastDot = fileName.lastIndexOf(".");
    const baseName = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;

    const thumbPath = `${dir}/${baseName}-thumb.jpg`;
    const thumbFile = Gio.File.new_for_path(thumbPath);
    const metadata = getVideoMetadata(`${dir}/${fileName}`);

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

    // Vertical container for top-right metadata (Row 1: Badges, Row 2: Duration & Size tags)
    const rightMetaContainer = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 4,
        halign: Gtk.Align.END,
        valign: Gtk.Align.START,
        margin_top: 5,
        margin_end: 5,
    });

    // Row 1: Sequential Badges [META] -> [Resolution] -> [Codec] -> [Extension]
    const badgesBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 4,
        halign: Gtk.Align.END,
    });

    if (metadata.hasChapters) {
        badgesBox.append(createMediaBadge("META", {
          bgColor:'#1E293B',
        }));
    }

    if (metadata.resTag) {
        const resColors = { uhd: '#BE185D', qhd: '#0F766E', hd: '#475569', sd: '#1E293B' };
        badgesBox.append(createMediaBadge(metadata.resTag, { bgColor: resColors[metadata.resTag.toLowerCase()] || '#1E293B' }));
    }

    if (metadata.codec) {
        const codecColors = { av1: '#BE185D', vp9: '#0F766E', h264: '#475569' };
        badgesBox.append(createMediaBadge(metadata.codec, { bgColor: codecColors[metadata.codec.toLowerCase()] || '#1E293B' }));
    }

    const colors = { mp4: '#475569', m3u: '#BE185D', mov: '#6D28D9', avi: '#B45309', mkv: '#B45309', webm: '#0F766E', gif: '#047857' };
    badgesBox.append(createMediaBadge(extension, { bgColor: colors[extension.toLowerCase()]}
    ));

    // Row 2: Duration and File Size text tags
    const bottomTagsBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 4,
        halign: Gtk.Align.END,
    });

    if (metadata.duration) {
        const durationLabel = new Gtk.Label({ label: metadata.duration });
        durationLabel.add_css_class("wallpaper-tag");
        bottomTagsBox.append(durationLabel);
    }

    const sizeLabel = new Gtk.Label({ label: sizeStr });
    sizeLabel.add_css_class("wallpaper-tag");
    bottomTagsBox.append(sizeLabel);

    // Assemble the top-right container
    rightMetaContainer.append(badgesBox);
    rightMetaContainer.append(bottomTagsBox);

    overlay.add_overlay(label);
    overlay.add_overlay(rightMetaContainer);

    if (isInstalled) {
        const installedLabel = new Gtk.Label({
            label: "INSTALLED",
            halign: Gtk.Align.START,
            valign: Gtk.Align.START,
            margin_start: 5,
            margin_top: 5,
        });
        installedLabel.add_css_class("installed-tag");
        overlay.add_overlay(installedLabel);
    }

    box.append(overlay);

    return box;
}
