import GLib from "gi://GLib";
import Gio from "gi://Gio";

export function getMediaParameters(quality, codec) {
    const height = quality ? null : parseInt(quality, 10);

    let formatSpec = height
        ? `bv[vcodec^=${codec}][height<=${height}]+ba/b[vcodec^=${codec}][height<=${height}]`
        : `bv[vcodec^=${codec}]+ba/b[vcodec^=${codec}]`;

    return {
        formatSpec,
        streamSpec: quality,
        codec,
        resTag: quality
    };
}

export function mediaFormat(filename, videoPath, stream = false) {
    if (!filename.toLowerCase().endsWith(".m3u")) {
        return stream ? [] : JSON.stringify({});
    }

    const [success, contents] = GLib.file_get_contents(videoPath);
    if (!success) {
        return stream ? [] : JSON.stringify({});
    }

    const text = new TextDecoder().decode(contents);
    const lines = text.split('\n');

    let format = null, codec = null, length = null, meta = null, title = null, url = null;

    for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
            format = line.match(/format="([^"]+)"/)?.[1] || null;
            codec = line.match(/codec="([^"]+)"/)?.[1] || null;
            length = line.match(/length="([^"]+)"/)?.[1] || null;
            meta = line.match(/meta='([\s\S]*?)'(?=\s*,)/)?.[1] || line.match(/meta="([^"]+)"/)?.[1] || null;

            const commaIndex = line.indexOf(',');
            if (commaIndex !== -1) {
                title = line.substring(commaIndex + 1).trim();
            }
        } else if (line.trim() && !line.startsWith('#')) {
            url = line.trim();
        }
    }

    // Determine if chapters exist from the meta string
    let hasChapters = false;
    if (meta) {
        try {
            const parsedMeta = JSON.parse(meta);
            hasChapters = Array.isArray(parsedMeta) && parsedMeta.length > 0;
        } catch (e) {
            hasChapters = false;
        }
    }

    if (stream) {
        const params = getMediaParameters(format, codec);
        return [`--ytdl-format=${params.formatSpec}`];
    }

    return JSON.stringify({ format, codec, length, meta, title, url, hasChapters});
}

export function mpvSocket(sessionId, commandArray) {
    if (!sessionId) return null;
    const socketPath = `/tmp/mpvsocket-${sessionId}`;
    try {
        const address = Gio.UnixSocketAddress.new(socketPath);
        const client = new Gio.SocketClient();
        const connection = client.connect(address, null);
        if (!connection) return null;

        connection.get_output_stream().write_bytes(new GLib.Bytes(JSON.stringify({ command: commandArray }) + '\n'), null);
        const dataInputStream = new Gio.DataInputStream({ base_stream: connection.get_input_stream() });
        const [line] = dataInputStream.read_line(null);
        let result = line ? JSON.parse(new TextDecoder().decode(line)).data : null;

        connection.close(null);
        return result;
    } catch (error) {
        console.error(`[Wallpaper] Failed to send IPC command to ${socketPath}: ${error.message}`);
        return null;
    }
}

export function extractImage(videoPath, thumbPath) {
    let target = videoPath;

    const [success, contents] = GLib.file_get_contents(videoPath);
    if (success) {
        const match = new TextDecoder().decode(contents).match(/(https?:\/\/[^\s"']+)/);
        if (match && match[1]) {
            try {
                const [ok, out] = GLib.spawn_command_line_sync(`yt-dlp --get-url "${match[1]}"`);
                if (ok) {
                    target = new TextDecoder().decode(out).trim().split('\n')[0];
                }
            } catch (e) {
                // Fallback to matched URL if yt-dlp lookup fails
                target = match[1];
            }
        }
    }

    return [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", "00:00:10", "-i", target,
        "-frames:v", "1",
        thumbPath
    ];
}

export async function processMediaAction(url, bgDir, quality, codec, stream) {
    const ytDlpPath = GLib.find_program_in_path("yt-dlp") || GLib.build_filenamev([GLib.get_home_dir(), ".local", "bin", "yt-dlp"]);
    const params = getMediaParameters(quality, codec);

    if (stream) {
        try {
            const proc = Gio.Subprocess.new(
                [ytDlpPath, "--no-warnings", "--no-playlist", "-j", url],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
            if (!proc.get_successful()) throw new Error(stderr || "Failed to get video info from yt-dlp");

            const info = JSON.parse(stdout);
            const title = info.title.substring(0, 62).replace(/[\\/:"*?<>]/g, '|').replace(/[—\-,]/g, '|');
            const fileName = `${title}.m3u`;

            const playlistContent = `#EXTM3U\n#EXTINF:-1 format="${params.streamSpec}" codec="${params.codec}" length="${info.duration || 0}" meta='${JSON.stringify(info.chapters || [])}', ${title}\n${url}\n`;
            GLib.file_set_contents(`${bgDir}/${fileName}`, playlistContent);
            return fileName;
        } catch (e) {
            logError(e);
            throw e;
        }
    }

    // Direct Download
    const outputTemplate = `${bgDir}/tmp/%(title)s.mp4`;
    const downloadProc = Gio.Subprocess.new([
        ytDlpPath, "--no-warnings", "--no-playlist",
        "--output", outputTemplate,
        "--format", params.formatSpec,
        "--merge-output-format", "mp4",
        "--embed-chapters", url
    ], Gio.SubprocessFlags.NONE);

    await downloadProc.wait_check_async(null);

    const tmpDir = Gio.File.new_for_path(`${bgDir}/tmp`);
    const enumerator = tmpDir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
    const fileName = enumerator.next_file(null).get_name();

    tmpDir.get_child(fileName).move(Gio.File.new_for_path(`${bgDir}/${fileName}`), Gio.FileCopyFlags.OVERWRITE, null, null);
    tmpDir.delete(null);

    return fileName;
}
