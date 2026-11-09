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
            "00:00:10",
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

export async function downloadYoutubeVideo(url, bgDir, quality = "SD", stream = false) {
  const ytDlpPath = GLib.find_program_in_path("yt-dlp") || GLib.build_filenamev([GLib.get_home_dir(), ".local", "bin", "yt-dlp"]);
  const outputTemplate = `${bgDir}/tmp/%(title)s.mp4`;

    let formatSpec;
    switch (quality) {
      case "SD":
          formatSpec = "bv[vcodec^=avc1][height<=720]+ba[ext=m4a]/b[vcodec^=avc1][height<=720]";
          break;
       case "HD":
          formatSpec = "bv[vcodec^=avc1][height<=1080]+ba[ext=m4a]/b[vcodec^=avc1][height<=1080]";
          break;
      case "UHD":
      default:
         formatSpec = "bv[vcodec^=avc1]+ba[ext=m4a]/b[vcodec^=avc1]";
         break;
    }

    const cmd = [
        ytDlpPath,
        "--output", outputTemplate,
        "--format", formatSpec,
        "--merge-output-format", "mp4",
        "--no-playlist",
        url
    ];

    if (stream) {
      console.error(`Streaming is under development`);
      }

    // Download file with all parameters set
    try {
        const downloadProc = Gio.Subprocess.new(cmd, Gio.SubprocessFlags.NONE);
        await downloadProc.wait_check_async(null);
    } catch (e) {
      throw new Error(`ERROR: ${e.message}`);
    }

    const tmpDir = Gio.File.new_for_path(`${bgDir}/tmp`);
    // Find the downloaded file in the tmp directory.
    const enumerator = tmpDir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
    const fileInfo = enumerator.next_file(null);
    const fileName = fileInfo.get_name();

    const sourceFile = tmpDir.get_child(fileName);
    const destFile = Gio.File.new_for_path(`${bgDir}/${fileName}`);

    // Move it into parent and delete tmp directory
    sourceFile.move(
      destFile,
      Gio.FileCopyFlags.OVERWRITE,
      null,
      null
    );
    tmpDir.delete(null);

    await ensureThumbnail(bgDir, fileName);

    return fileName;
}
