import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { ensureBackgroundsDir, getBackgroundsDir } from "../utils.js";
import {
    detectMediaType,
    isSupportedMedia,
    isThumbnailArtifact,
} from "./mediaTypes.js";

Gio._promisify(Gio.File.prototype, "copy_async", "copy_finish");

const CATALOG_FILE_NAME = "media-catalog.json";
const CATALOG_VERSION = 1;

export class MediaCatalogService {
    constructor() {
        this._dataDir = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            "gnome-wallpaper-engine",
        ]);
        this._backgroundsDir = getBackgroundsDir();
        this._catalogPath = GLib.build_filenamev([this._dataDir, CATALOG_FILE_NAME]);
        this._catalog = null;
    }

    getBackgroundsDirPath() {
        return this._backgroundsDir;
    }

    getMediaPath(itemOrFileName) {
        const fileName = typeof itemOrFileName === "string"
            ? itemOrFileName
            : itemOrFileName?.fileName;

        if (!fileName) {
            return "";
        }

        return GLib.build_filenamev([this._backgroundsDir, fileName]);
    }

    listItems() {
        this._ensureCatalogLoaded();
        this._syncCatalogWithDirectory();

        return this._catalog.items.map((item) => this._cloneItem(item));
    }

    async importMedia(sourceFile) {
        if (!sourceFile) {
            throw new Error("A source file is required for import.");
        }

        this._ensureCatalogLoaded();
        this._ensureStorageReady();

        const sourceInfo = sourceFile.query_info(
            "standard::name,standard::content-type",
            Gio.FileQueryInfoFlags.NONE,
            null,
        );
        const sourceName = sourceFile.get_basename() || sourceInfo.get_name();
        const sourceContentType = sourceInfo.get_content_type() || "";
        const sourceMimeType = Gio.content_type_get_mime_type(sourceContentType) || "";
        const mediaType = detectMediaType(sourceName, sourceMimeType);

        if (!isSupportedMedia(sourceName, sourceMimeType)) {
            throw new Error(
                `Unsupported media format for "${sourceName}" (${sourceMimeType || "unknown"}).`,
            );
        }

        const targetFileName = this._buildUniqueFileName(sourceName);
        const targetPath = GLib.build_filenamev([this._backgroundsDir, targetFileName]);
        const targetFile = Gio.File.new_for_path(targetPath);

        await sourceFile.copy_async(
            targetFile,
            Gio.FileCopyFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            null,
        );

        const importedAt = this._nowIsoString();
        const item = this._createItem({
            fileName: targetFileName,
            mediaType,
            mimeType: sourceMimeType,
            importedAt,
            updatedAt: importedAt,
        });

        this._catalog.items.push(item);
        this._sortCatalog();
        this._saveCatalog();

        return this._cloneItem(item);
    }

    updateThumbnailStatus(itemId, thumbnail) {
        if (!itemId) {
            return null;
        }

        this._ensureCatalogLoaded();

        const item = this._catalog.items.find((entry) => entry.id === itemId);
        if (!item) {
            return null;
        }

        const nextThumbnail = {
            ...item.thumbnail,
            ...(thumbnail || {}),
        };

        if (this._isSameThumbnail(item.thumbnail, nextThumbnail)) {
            return this._cloneItem(item);
        }

        item.thumbnail = nextThumbnail;
        item.updatedAt = this._nowIsoString();
        this._saveCatalog();

        return this._cloneItem(item);
    }

    _ensureCatalogLoaded() {
        if (this._catalog !== null) {
            return;
        }

        this._ensureStorageReady();

        if (!GLib.file_test(this._catalogPath, GLib.FileTest.EXISTS)) {
            this._catalog = this._createEmptyCatalog();
            this._saveCatalog();
            return;
        }

        try {
            const [ok, raw] = GLib.file_get_contents(this._catalogPath);

            if (!ok) {
                throw new Error("Unable to read catalog file.");
            }

            const content = new TextDecoder().decode(raw);
            const parsed = JSON.parse(content);

            this._catalog = this._normalizeCatalog(parsed);
        } catch (error) {
            logError(error);
            this._catalog = this._createEmptyCatalog();
            this._saveCatalog();
        }
    }

    _ensureStorageReady() {
        ensureBackgroundsDir();

        const dataDir = Gio.File.new_for_path(this._dataDir);
        if (!dataDir.query_exists(null)) {
            dataDir.make_directory_with_parents(null);
        }
    }

    _syncCatalogWithDirectory() {
        const discovered = this._scanBackgroundsDirectory();
        const discoveredByName = new Map(discovered.map((item) => [item.fileName, item]));
        const currentByName = new Map(this._catalog.items.map((item) => [item.fileName, item]));

        let changed = false;

        for (const item of this._catalog.items) {
            if (!discoveredByName.has(item.fileName)) {
                changed = true;
            }
        }

        this._catalog.items = this._catalog.items.filter((item) =>
            discoveredByName.has(item.fileName)
        );

        for (const discoveredItem of discovered) {
            const existingItem = currentByName.get(discoveredItem.fileName);

            if (!existingItem) {
                this._catalog.items.push(this._createItem(discoveredItem));
                changed = true;
                continue;
            }

            if (
                existingItem.mediaType !== discoveredItem.mediaType ||
                existingItem.mimeType !== discoveredItem.mimeType
            ) {
                existingItem.mediaType = discoveredItem.mediaType;
                existingItem.mimeType = discoveredItem.mimeType;
                existingItem.updatedAt = this._nowIsoString();
                changed = true;
            }
        }

        if (changed) {
            this._sortCatalog();
            this._saveCatalog();
        }
    }

    _scanBackgroundsDirectory() {
        const directory = Gio.File.new_for_path(this._backgroundsDir);
        const discovered = [];

        if (!directory.query_exists(null)) {
            return discovered;
        }

        const enumerator = directory.enumerate_children(
            "standard::name,standard::content-type,standard::type",
            Gio.FileQueryInfoFlags.NONE,
            null,
        );

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (info.get_file_type() !== Gio.FileType.REGULAR) {
                continue;
            }

            const fileName = info.get_name();
            if (!fileName || isThumbnailArtifact(fileName)) {
                continue;
            }

            const contentType = info.get_content_type() || "";
            const mimeType = Gio.content_type_get_mime_type(contentType) || "";
            const mediaType = detectMediaType(fileName, mimeType);

            if (mediaType === "unknown") {
                continue;
            }

            discovered.push({
                fileName,
                mediaType,
                mimeType,
                importedAt: this._nowIsoString(),
                updatedAt: this._nowIsoString(),
            });
        }

        return discovered;
    }

    _buildUniqueFileName(fileName) {
        const dotIndex = fileName.lastIndexOf(".");
        const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
        const extension = dotIndex > 0 ? fileName.slice(dotIndex) : "";

        let suffix = 0;
        let candidate = fileName;

        while (this._candidateExists(candidate)) {
            suffix += 1;
            candidate = `${stem}-${suffix}${extension}`;
        }

        return candidate;
    }

    _candidateExists(fileName) {
        const path = GLib.build_filenamev([this._backgroundsDir, fileName]);
        const fileExists = GLib.file_test(path, GLib.FileTest.EXISTS);
        const inCatalog = this._catalog.items.some((item) => item.fileName === fileName);

        return fileExists || inCatalog;
    }

    _saveCatalog() {
        const content = JSON.stringify(this._catalog, null, 2);
        GLib.file_set_contents(this._catalogPath, content);
    }

    _sortCatalog() {
        this._catalog.items.sort((left, right) =>
            left.fileName.localeCompare(right.fileName, undefined, {
                sensitivity: "base",
                numeric: true,
            })
        );
    }

    _normalizeCatalog(rawCatalog) {
        if (!rawCatalog || typeof rawCatalog !== "object") {
            return this._createEmptyCatalog();
        }

        const rawItems = Array.isArray(rawCatalog.items) ? rawCatalog.items : [];
        const seenIds = new Set();
        const normalizedItems = [];

        for (const rawItem of rawItems) {
            const item = this._normalizeItem(rawItem);

            if (!item.fileName) {
                continue;
            }

            if (seenIds.has(item.id)) {
                item.id = this._createStableId();
            }

            seenIds.add(item.id);
            normalizedItems.push(item);
        }

        return {
            version: CATALOG_VERSION,
            items: normalizedItems,
        };
    }

    _normalizeItem(rawItem) {
        if (!rawItem || typeof rawItem !== "object") {
            return this._createItem({});
        }

        const fileName = String(rawItem.fileName || "");
        const mimeType = String(rawItem.mimeType || "");
        const detectedType = detectMediaType(fileName, mimeType);
        const savedType = String(rawItem.mediaType || "").toLowerCase();
        const mediaType = normalizeMediaType(
            detectedType === "unknown" ? savedType : detectedType,
        );
        const now = this._nowIsoString();

        return {
            id: rawItem.id || this._createStableId(),
            fileName,
            mediaType,
            mimeType,
            importedAt: rawItem.importedAt || now,
            updatedAt: rawItem.updatedAt || now,
            thumbnail: {
                status: rawItem.thumbnail?.status || "unknown",
                path: rawItem.thumbnail?.path || "",
                format: rawItem.thumbnail?.format || "",
                error: rawItem.thumbnail?.error || "",
                checkedAt: rawItem.thumbnail?.checkedAt || "",
            },
        };
    }

    _createItem({
        fileName = "",
        mediaType = "video",
        mimeType = "",
        importedAt = "",
        updatedAt = "",
    }) {
        const now = this._nowIsoString();

        return {
            id: this._createStableId(),
            fileName,
            mediaType: normalizeMediaType(mediaType),
            mimeType,
            importedAt: importedAt || now,
            updatedAt: updatedAt || now,
            thumbnail: {
                status: "unknown",
                path: "",
                format: "",
                error: "",
                checkedAt: "",
            },
        };
    }

    _createEmptyCatalog() {
        return {
            version: CATALOG_VERSION,
            items: [],
        };
    }

    _createStableId() {
        if (typeof GLib.uuid_string_random === "function") {
            return GLib.uuid_string_random();
        }

        const timestamp = GLib.get_real_time();
        const randomPart = `${Math.random()}`.slice(2, 10);
        return `media-${timestamp}-${randomPart}`;
    }

    _cloneItem(item) {
        return {
            ...item,
            thumbnail: { ...(item.thumbnail || {}) },
        };
    }

    _isSameThumbnail(previous, next) {
        const left = previous || {};
        const right = next || {};

        return left.status === right.status
            && left.path === right.path
            && left.format === right.format
            && left.error === right.error
            && left.checkedAt === right.checkedAt;
    }

    _nowIsoString() {
        return new Date().toISOString();
    }
}

function normalizeMediaType(mediaType) {
    if (mediaType === "image" || mediaType === "video") {
        return mediaType;
    }

    return "video";
}
