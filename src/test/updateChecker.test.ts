import * as assert from "assert";
import { isNewer, shouldCheckToday, recordCheckDate, StateStore } from "../updateCheckerUtils";

// ── Minimal stub satisfying the StateStore interface ─────────────────────────
function makeStore(stored: Record<string, string> = {}): StateStore {
    const state = { ...stored };
    return {
        get(key: string, defaultValue: string): string {
            return key in state ? state[key] : defaultValue;
        },
        async update(key: string, value: string): Promise<void> {
            state[key] = value;
        },
    };
}

// ── isNewer ───────────────────────────────────────────────────────────────────
describe("isNewer", () => {
    it("returns false when versions are identical", () => {
        assert.strictEqual(isNewer("1.0.0", "1.0.0"), false);
        assert.strictEqual(isNewer("1.0.0-beta", "1.0.0-beta"), false);
    });

    it("detects a patch bump", () => {
        assert.strictEqual(isNewer("1.0.0", "1.0.1"), true);
        assert.strictEqual(isNewer("1.0.1", "1.0.0"), false);
    });

    it("detects a minor bump", () => {
        assert.strictEqual(isNewer("1.0.0", "1.1.0"), true);
        assert.strictEqual(isNewer("1.1.0", "1.0.9"), false);
    });

    it("detects a major bump", () => {
        assert.strictEqual(isNewer("1.9.9", "2.0.0"), true);
        assert.strictEqual(isNewer("2.0.0", "1.9.9"), false);
    });

    it("treats release as newer than pre-release with same numeric parts", () => {
        // 1.0.0 (release) > 1.0.0-beta (pre-release)
        assert.strictEqual(isNewer("1.0.0-beta", "1.0.0"), true);
        assert.strictEqual(isNewer("1.0.0", "1.0.0-beta"), false);
    });

    it("compares pre-release suffixes lexicographically when numeric parts equal", () => {
        // "rc1" > "beta" lexicographically
        assert.strictEqual(isNewer("1.0.0-beta", "1.0.0-rc1"), true);
        assert.strictEqual(isNewer("1.0.0-rc1", "1.0.0-beta"), false);
    });

    it("patch bump beats pre-release label", () => {
        assert.strictEqual(isNewer("1.0.0-beta", "1.0.1-beta"), true);
    });

    it("handles versions with different segment counts", () => {
        assert.strictEqual(isNewer("1.0", "1.0.1"), true);
        assert.strictEqual(isNewer("1.0.1", "1.0"), false);
    });

    it("handles the current beta versioning scheme", () => {
        assert.strictEqual(isNewer("1.0.0-beta", "1.0.1-beta"), true);
        assert.strictEqual(isNewer("1.0.1-beta", "1.0.0-beta"), false);
        assert.strictEqual(isNewer("1.0.1-beta", "1.0.1-beta"), false);
    });
});

// ── shouldCheckToday / recordCheckDate ───────────────────────────────────────
describe("shouldCheckToday", () => {
    it("returns true when no previous check is recorded", () => {
        const ctx = makeStore();
        assert.strictEqual(shouldCheckToday(ctx), true);
    });

    it("returns false if already checked today", async () => {
        const ctx = makeStore();
        await recordCheckDate(ctx);
        assert.strictEqual(shouldCheckToday(ctx), false);
    });

    it("returns true if the stored date is a past date", async () => {
        const ctx = makeStore({ "lc3.updateChecker.lastCheckDate": "2000-01-01" });
        assert.strictEqual(shouldCheckToday(ctx), true);
    });

    it("returns false again after recording today's date", async () => {
        const ctx = makeStore();
        assert.strictEqual(shouldCheckToday(ctx), true);
        await recordCheckDate(ctx);
        assert.strictEqual(shouldCheckToday(ctx), false);
        // Calling again still false
        assert.strictEqual(shouldCheckToday(ctx), false);
    });
});

// ── recordCheckDate ───────────────────────────────────────────────────────────
describe("recordCheckDate", () => {
    it("stores today's date in ISO format YYYY-MM-DD", async () => {
        const store = makeStore();
        await recordCheckDate(store);
        const stored = store.get("lc3.updateChecker.lastCheckDate", "");
        const today = new Date().toISOString().slice(0, 10);
        assert.strictEqual(stored, today);
    });
});
