import Gio from "gi://Gio";
import GLib from "gi://GLib";

Gio._promisify(Gio.File.prototype, "copy_async", "copy_finish");
Gio._promisify(
    Gio.Subprocess.prototype,
    "wait_check_async",
    "wait_check_finish",
);

export async function generateThumbnail(videoPath, thumbPath) {
    try {
        const cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            "00:00:01",
            "-i",
            videoPath,
            "-frames:v",
            "1",
            thumbPath,
        ];

        const proc = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
        await proc.wait_check_async(null);
    } catch (e) {
        console.error(
            `Error during thumbnail generation for ${videoPath}:`,
            e,
        );
    }
}

export const ensureThumbnail = async (bgDir, fileName) => {
    const fullPath = `${bgDir}/${fileName}`;
    const baseName = fileName.substring(0, fileName.lastIndexOf("."));
    const thumbPath = `${bgDir}/${baseName}-thumb.jpg`;

    const thumbFile = Gio.File.new_for_path(thumbPath);

    if (!thumbFile.query_exists(null)) {
        await generateThumbnail(fullPath, thumbPath);
    }
};

export async function importWallpaper(sourceFile, bgDir) {
    const fileName = sourceFile.get_basename();
    const destPath = `${bgDir}/${fileName}`;
    const destFile = Gio.File.new_for_path(destPath);

    await sourceFile.copy_async(
        destFile,
        Gio.FileCopyFlags.OVERWRITE,
        GLib.PRIORITY_DEFAULT,
        null,
        null,
    );

    await ensureThumbnail(bgDir, fileName);

    return fileName;
}
