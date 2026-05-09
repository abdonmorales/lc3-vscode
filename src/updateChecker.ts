import * as vscode from "vscode";
import { isNewer, shouldCheckToday, recordCheckDate } from "./updateCheckerUtils";

// ═══════════════════════════════════════════════════════════════════
//  UT-INTERNAL UPDATE CHECKER
//
//  The public extension polls the GitHub Releases API for new versions.
//  The internal UT Austin / ECE 306 build is not on GitHub Releases —
//  it lives behind the course's CS webpage:
//
//      https://www.cs.utexas.edu/~abdonm/lc3-extension.html
//
//  So instead of GitHub, we poll a tiny static JSON manifest hosted on
//  the same CS page. Format:
//
//      {
//        "version": "1.0.3",
//        "url": "https://www.cs.utexas.edu/~abdonm/lc3-extension.html"
//      }
//
//  Throttled to one check per calendar day, fails silently on network
//  error. Exactly the same UX as the public version — only the source
//  of truth changes.
// ═══════════════════════════════════════════════════════════════════

const MANIFEST_URL = "https://www.cs.utexas.edu/~abdonm/lc3-extension.json";
const DOWNLOAD_PAGE = "https://www.cs.utexas.edu/~abdonm/lc3-extension.html";
const EXTENSION_ID = "ece306.lc3-assembly-ut";

interface UpdateManifest {
    version?: string;
    url?: string;
}

/**
 * Fetch the latest version manifest from the CS webpage and return the
 * version string, or null on any failure (network error, malformed JSON,
 * missing field). The "fail-silent" behavior is intentional — students
 * on flaky campus Wi-Fi shouldn't see error popups every activation.
 */
export async function fetchLatestVersion(): Promise<string | null> {
    try {
        const response = await fetch(MANIFEST_URL, {
            headers: { "User-Agent": "lc3-vscode-ut-update-checker" },
        });
        if (!response.ok) return null;
        const data = (await response.json()) as UpdateManifest;
        if (!data.version) return null;
        return data.version.replace(/^v/, "");
    } catch {
        return null;
    }
}

/**
 * Main entry point — call from activate(). Checks once per day and
 * shows a notification if the CS webpage is advertising a newer build.
 * The "Download" button opens the course page (not the .vsix directly),
 * so students see install instructions in context.
 */
export async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
    if (!shouldCheckToday(context.globalState)) return;
    await recordCheckDate(context.globalState);

    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (!ext) return;
    const current: string = ext.packageJSON.version;

    const latest = await fetchLatestVersion();
    if (!latest) return;

    if (isNewer(current, latest)) {
        const choice = await vscode.window.showInformationMessage(
            `LC-3 Assembly (UT Austin): update available (v${latest})`,
            "Open Download Page",
            "Dismiss"
        );
        if (choice === "Open Download Page") {
            vscode.env.openExternal(vscode.Uri.parse(DOWNLOAD_PAGE));
        }
    }
}
