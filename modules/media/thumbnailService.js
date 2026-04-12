import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GdkPixbuf from "gi://GdkPixbuf";

import { getBackgroundsDir } from "../utils.js";

Gio._promisify(
    Gio.Subprocess.prototype,
    "wait_check_async",
    "wait_check_finish",
);

const THUMBNAIL_FORMATS = Object.freeze(["webp", "png", "jpg"]);

export class ThumbnailService {
    constructor(mediaCatalog) {
        this._mediaCatalog = mediaCatalog;
        this._backgroundsDir = getBackgroundsDir();
        this._pendingByItemId = new Map();
    }

    async ensureThumbnail(item) {
        if (!item?.id) {
            return this._buildResult({
                status: "failed",
                error: "Invalid media item.",
            });
        }

        const runningTask = this._pendingByItemId.get(item.id);
        if (runningTask) {
            return runningTask;
        }

        const task = this._ensureThumbnailInternal(item)
            .finally(() => this._pendingByItemId.delete(item.id));

        this._pendingByItemId.set(item.id, task);
        return task;
    }

    async _ensureThumbnailInternal(item) {
        const sourcePath = this._mediaCatalog.getMediaPath(item);

        if (!sourcePath || !GLib.file_test(sourcePath, GLib.FileTest.EXISTS)) {
            return this._persistResult(item.id, this._buildResult({
                status: "missing-source",
                error: "Media file does not exist anymore.",
            }));
        }

        const baseName = this._getBaseName(item.fileName);
        const candidatePaths = this._buildCandidatePaths(baseName);
        const existing = this._findExistingValidThumbnail(candidatePaths);

        if (existing) {
            return this._persistResult(item.id, this._buildResult({
                status: existing.format === "webp" ? "ready" : "fallback",
                thumbnailPath: existing.path,
                format: existing.format,
            }));
        }

        let lastError = "";

        for (const format of THUMBNAIL_FORMATS) {
            const outputPath = candidatePaths[format];
            const generated = await this._generateThumbnail(item, sourcePath, outputPath);

            if (!generated.ok) {
                if (generated.error) {
                    lastError = generated.error;
                }
                continue;
            }

            if (format !== "webp") {
                this._mirrorFallbackIntoLegacyWebp(outputPath, candidatePaths.webp);
            }

            const preferredPath = this._pickPreferredPath(candidatePaths, outputPath);

            return this._persistResult(item.id, this._buildResult({
                status: format === "webp" ? "ready" : "fallback",
                thumbnailPath: preferredPath,
                format,
            }));
        }

        return this._persistResult(item.id, this._buildResult({
            status: "failed",
            error: lastError || "Unable to generate a valid thumbnail.",
        }));
    }

    async _generateThumbnail(item, sourcePath, outputPath) {
        this._deleteFileIfExists(outputPath);

        const commands = this._buildFfmpegCommands(item, sourcePath, outputPath);
        let lastError = "";

        for (const command of commands) {
            try {
                const process = Gio.Subprocess.new(command, Gio.SubprocessFlags.NONE);
                await process.wait_check_async(null);

                if (this._isValidImage(outputPath)) {
                    return { ok: true, error: "" };
                }

                lastError = "Generated thumbnail file is invalid.";
            } catch (error) {
                lastError = error?.message || "Thumbnail command failed.";
            }

            this._deleteFileIfExists(outputPath);
        }

        return { ok: false, error: lastError };
    }

    _buildFfmpegCommands(item, sourcePath, outputPath) {
        const commonArgs = [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
        ];
        const captureArgs = [
            "-i",
            sourcePath,
            "-frames:v",
            "1",
            outputPath,
        ];

        if (item.mediaType !== "video") {
            return [[...commonArgs, ...captureArgs]];
        }

        return [
            [...commonArgs, "-ss", "00:00:01", ...captureArgs],
            [...commonArgs, "-ss", "00:00:00", ...captureArgs],
        ];
    }

    _persistResult(itemId, result) {
        const payload = {
            status: result.status,
            path: result.thumbnailPath || "",
            format: result.format || "",
            error: result.error || "",
            checkedAt: result.checkedAt,
        };

        this._mediaCatalog.updateThumbnailStatus(itemId, payload);
        return result;
    }

    _findExistingValidThumbnail(candidatePaths) {
        for (const format of THUMBNAIL_FORMATS) {
            const path = candidatePaths[format];
            if (this._isValidImage(path)) {
                return { path, format };
            }
        }

        return null;
    }

    _buildCandidatePaths(baseName) {
        return {
            webp: GLib.build_filenamev([this._backgroundsDir, `${baseName}-thumb.webp`]),
            png: GLib.build_filenamev([this._backgroundsDir, `${baseName}-thumb.png`]),
            jpg: GLib.build_filenamev([this._backgroundsDir, `${baseName}-thumb.jpg`]),
        };
    }

    _pickPreferredPath(candidatePaths, generatedPath) {
        if (this._isValidImage(candidatePaths.webp)) {
            return candidatePaths.webp;
        }

        return generatedPath;
    }

    _mirrorFallbackIntoLegacyWebp(sourcePath, targetWebpPath) {
        if (!sourcePath || !targetWebpPath || sourcePath === targetWebpPath) {
            return;
        }

        try {
            const [ok, contents] = GLib.file_get_contents(sourcePath);
            if (!ok) {
                return;
            }

            GLib.file_set_contents(targetWebpPath, contents);

            if (!this._isValidImage(targetWebpPath)) {
                this._deleteFileIfExists(targetWebpPath);
            }
        } catch (_) {
            this._deleteFileIfExists(targetWebpPath);
        }
    }

    _isValidImage(path) {
        if (!path || !GLib.file_test(path, GLib.FileTest.EXISTS)) {
            return false;
        }

        try {
            const file = Gio.File.new_for_path(path);
            const info = file.query_info(
                "standard::size",
                Gio.FileQueryInfoFlags.NONE,
                null,
            );

            if (info.get_size() <= 0) {
                return false;
            }

            const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
            return pixbuf !== null;
        } catch (_) {
            return false;
        }
    }

    _deleteFileIfExists(path) {
        if (!path || !GLib.file_test(path, GLib.FileTest.EXISTS)) {
            return;
        }

        try {
            GLib.unlink(path);
        } catch (_) {
        }
    }

    _getBaseName(fileName) {
        const dotIndex = fileName.lastIndexOf(".");
        return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    }

    _buildResult({
        status,
        thumbnailPath = "",
        format = "",
        error = "",
    }) {
        return {
            status,
            thumbnailPath,
            format,
            error,
            checkedAt: new Date().toISOString(),
        };
    }
}
