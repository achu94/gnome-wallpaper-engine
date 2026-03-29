export function debug(msg) {
    try {
        if (msg === null) {
            log(`[;;; DEBUG] null`);
        } else if (typeof msg === "object") {
            log(`[;; DEBUG] ${JSON.stringify(msg, getCircularReplacer(), 2)}`);
        } else {
            log(`[;;; DEBUG] ${msg}`);
        }
    } catch (e) {
        log(`[;;; DEBUG] (failed to stringify)`);
        logError(e);
    }
}

function getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "[Circular]";
            }
            seen.add(value);
        }
        return value;
    };
}
