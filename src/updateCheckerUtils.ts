// Pure update-checker logic — no vscode dependency so it's unit-testable.

export const LAST_CHECK_KEY = "lc3.updateChecker.lastCheckDate";

/** Minimal interface satisfied by vscode.ExtensionContext.globalState */
export interface StateStore {
    get(key: string, defaultValue: string): string;
    update(key: string, value: string): PromiseLike<void>;
}

/**
 * Compare two semver-ish version strings (e.g. "1.0.1-beta" > "1.0.0-beta").
 * Returns true if `latest` is strictly newer than `current`.
 */
export function isNewer(current: string, latest: string): boolean {
    if (current === latest) return false;

    const parse = (v: string): [number[], string] => {
        const [numeric, ...pre] = v.split("-");
        const parts = numeric.split(".").map((n) => parseInt(n, 10) || 0);
        return [parts, pre.join("-")];
    };

    const [curParts, curPre] = parse(current);
    const [latParts, latPre] = parse(latest);

    const len = Math.max(curParts.length, latParts.length);
    for (let i = 0; i < len; i++) {
        const c = curParts[i] ?? 0;
        const l = latParts[i] ?? 0;
        if (l > c) return true;
        if (l < c) return false;
    }

    // Numeric parts equal — a version without a pre-release suffix is
    // considered newer than one with (1.0.0 > 1.0.0-beta).
    if (curPre && !latPre) return true;
    if (!curPre && latPre) return false;

    // Both have pre-release suffixes: compare lexicographically
    return latPre > curPre;
}

/**
 * Returns true if we haven't checked today yet.
 * Throttles to one check per calendar day to avoid hammering the API.
 */
export function shouldCheckToday(store: StateStore): boolean {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const last = store.get(LAST_CHECK_KEY, "");
    return last !== today;
}

/**
 * Record that we checked today so we don't re-check until tomorrow.
 */
export function recordCheckDate(store: StateStore): PromiseLike<void> {
    const today = new Date().toISOString().slice(0, 10);
    return store.update(LAST_CHECK_KEY, today);
}
