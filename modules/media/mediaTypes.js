const VIDEO_EXTENSIONS = Object.freeze([
    ".mp4",
    ".webm",
    ".mkv",
    ".mov",
    ".avi",
    ".gif",
]);

const IMAGE_EXTENSIONS = Object.freeze([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
]);

export const VIDEO_MIME_TYPES = Object.freeze([
    "video/mp4",
    "video/webm",
    "video/x-matroska",
    "video/quicktime",
    "video/x-msvideo",
    "image/gif",
]);

export const IMAGE_MIME_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
]);

const THUMBNAIL_FILE_REGEX = /-thumb\.(webp|png|jpe?g)$/i;

function normalizeExtension(fileName) {
    const dotIndex = fileName.lastIndexOf(".");

    if (dotIndex < 0) {
        return "";
    }

    return fileName.slice(dotIndex).toLowerCase();
}

export function getMediaTypeLabel(mediaType) {
    if (mediaType === "video") {
        return "Video";
    }

    if (mediaType === "image") {
        return "Image";
    }

    return "Unknown";
}

export function detectMediaType(fileName, mimeType = "") {
    const extension = normalizeExtension(fileName);
    const normalizedMime = (mimeType || "").toLowerCase();

    if (
        VIDEO_EXTENSIONS.includes(extension) ||
        VIDEO_MIME_TYPES.includes(normalizedMime)
    ) {
        return "video";
    }

    if (
        IMAGE_EXTENSIONS.includes(extension) ||
        IMAGE_MIME_TYPES.includes(normalizedMime)
    ) {
        return "image";
    }

    return "unknown";
}

export function isSupportedMedia(fileName, mimeType = "") {
    return detectMediaType(fileName, mimeType) !== "unknown";
}

export function isThumbnailArtifact(fileName) {
    return THUMBNAIL_FILE_REGEX.test(fileName);
}

export function getSupportedMimeTypes() {
    return [...VIDEO_MIME_TYPES, ...IMAGE_MIME_TYPES];
}

export function getSupportedFormatDescription() {
    return [
        "MP4",
        "WebM",
        "MKV",
        "MOV",
        "AVI",
        "GIF",
        "JPG",
        "PNG",
        "WebP",
        "BMP",
        "TIFF",
    ].join(", ");
}
