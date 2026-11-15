// The wallpaper library on disk: listing, importing and thumbnails.
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { ensureBackgroundsDir, getBackgroundsDir } from "../modules/utils.js";
import { isVideoFile } from "../modules/monitorConfig.js";

Gio._promisify(Gio.File.prototype, "copy_async", "copy_finish");
Gio._promisify(Gio.File.prototype, "enumerate_children_async", "enumerate_children_finish");
Gio._promisify(Gio.FileEnumerator.prototype, "next_files_async", "next_files_finish");
Gio._promisify(Gio.Subprocess.prototype, "wait_check_async", "wait_check_finish");
Gio._promisify(Gio.Subprocess.prototype, "communicate_utf8_async", "communicate_utf8_finish");

export function thumbPathFor(fileName) {
    const dot = fileName.lastIndexOf(".");
    const baseName = dot === -1 ? fileName : fileName.substring(0, dot);
    return `${getBackgroundsDir()}/${baseName}-thumb.jpg`;
}

// Many wallpapers fade in from black, so take the frame 30% of the way in.
async function thumbnailTime(videoPath) {
    try {
        const proc = Gio.Subprocess.new(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
        );
        const [stdout] = await proc.communicate_utf8_async(null, null);
        const duration = Number.parseFloat(stdout);
        if (Number.isFinite(duration) && duration > 0) return (duration * 0.3).toFixed(2);
    } catch (_) {
        // fall back below
    }
    return "1";
}

async function generateThumbnail(videoPath, thumbPath) {
    try {
        const proc = Gio.Subprocess.new(
            ["ffmpeg", "-y", "-ss", await thumbnailTime(videoPath), "-i", videoPath, "-frames:v", "1", thumbPath],
            Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE,
        );
        await proc.wait_check_async(null);
    } catch (e) {
        console.error(`Thumbnail generation failed for ${videoPath}:`, e);
    }
}

export async function ensureThumbnail(fileName) {
    const thumbPath = thumbPathFor(fileName);
    if (!Gio.File.new_for_path(thumbPath).query_exists(null)) {
        await generateThumbnail(`${getBackgroundsDir()}/${fileName}`, thumbPath);
    }
}

// Video file names in the library, sorted.
export function listWallpaperFiles() {
    const names = [];
    try {
        const enumerator = ensureBackgroundsDir().enumerate_children(
            "standard::name", Gio.FileQueryInfoFlags.NONE, null,
        );
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (isVideoFile(info.get_name())) names.push(info.get_name());
        }
    } catch (e) {
        console.error(e);
    }
    return names.sort((a, b) => a.localeCompare(b));
}

// Supported videos directly inside a folder (not recursive), as Gio.Files.
export async function listVideosInFolder(folder) {
    const enumerator = await folder.enumerate_children_async(
        "standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null,
    );
    const files = [];
    for (;;) {
        const batch = await enumerator.next_files_async(64, GLib.PRIORITY_DEFAULT, null);
        if (batch.length === 0) break;
        for (const info of batch) {
            if (info.get_file_type() === Gio.FileType.REGULAR && isVideoFile(info.get_name())) {
                files.push(folder.get_child(info.get_name()));
            }
        }
    }
    return files.sort((a, b) => a.get_basename().localeCompare(b.get_basename()));
}

function sameSize(a, b) {
    try {
        const size = (f) => f.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null).get_size();
        return size(a) === size(b);
    } catch (_) {
        return false;
    }
}

// Copy videos into the library and make their thumbnails. A file that is
// already there with the same name and size is skipped, so importing the
// same folder twice is harmless. Returns { imported, skipped, failed }.
export async function importFiles(sourceFiles, onProgress = () => {}) {
    const bgDir = getBackgroundsDir();
    ensureBackgroundsDir();
    const result = { imported: [], skipped: [], failed: [] };

    for (const [i, source] of sourceFiles.entries()) {
        const name = source.get_basename();
        onProgress(i + 1, sourceFiles.length, name);
        const dest = Gio.File.new_for_path(`${bgDir}/${name}`);
        try {
            if (dest.query_exists(null) && sameSize(source, dest)) {
                result.skipped.push(name);
            } else {
                await source.copy_async(dest, Gio.FileCopyFlags.OVERWRITE, GLib.PRIORITY_DEFAULT, null, null);
                result.imported.push(name);
                // Replaced contents need a fresh thumbnail.
                try { Gio.File.new_for_path(thumbPathFor(name)).delete(null); } catch (_) { /* none yet */ }
            }
            await ensureThumbnail(name);
        } catch (e) {
            console.error(`Import failed for ${name}:`, e);
            result.failed.push(name);
        }
    }
    return result;
}
