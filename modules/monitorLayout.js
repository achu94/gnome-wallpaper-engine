// Geometry for the monitor picture in prefs. Pure JS so it can be unit-tested.

// Fit the desktop (all monitors) into an area of areaWidth x areaHeight,
// keeping proportions, centred, with `padding` around it. Each monitor is
// inset by gap/2 so neighbours have a visible gap between them.
// Returns [{ connector, x, y, width, height }] in area coordinates.
export function layoutMonitors(monitors, areaWidth, areaHeight, padding, gap) {
    if (!monitors.length) return [];

    const left = Math.min(...monitors.map((m) => m.x));
    const top = Math.min(...monitors.map((m) => m.y));
    const desktopWidth = Math.max(...monitors.map((m) => m.x + m.width)) - left;
    const desktopHeight = Math.max(...monitors.map((m) => m.y + m.height)) - top;

    const scale = Math.min(
        (areaWidth - 2 * padding) / desktopWidth,
        (areaHeight - 2 * padding) / desktopHeight,
    );
    const offsetX = (areaWidth - desktopWidth * scale) / 2;
    const offsetY = (areaHeight - desktopHeight * scale) / 2;
    const inset = gap / 2;

    return monitors.map((m) => ({
        connector: m.connector,
        x: offsetX + (m.x - left) * scale + inset,
        y: offsetY + (m.y - top) * scale + inset,
        width: m.width * scale - gap,
        height: m.height * scale - gap,
    }));
}

// Connector of the monitor rect under (x, y), or null.
export function monitorAt(rects, x, y) {
    const hit = rects.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    return hit?.connector ?? null;
}
