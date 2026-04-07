import * as vscode from "vscode";
import { isNewer, shouldCheckToday, recordCheckDate } from "./updateCheckerUtils";

// ═══════════════════════════════════════════════════════════════════
//  OPTION 1 (ACTIVE) — GitHub Releases update checker
//
//  On activation, fetches the latest release from GitHub once per
//  calendar day. If a newer version is available, shows a VS Code
//  information message with a "Download" button.
//
//  No infrastructure required — GitHub Releases is the source of
//  truth. User still installs manually; this is a nudge, not a
//  silent auto-install.
// ═══════════════════════════════════════════════════════════════════

const RELEASES_API = "https://api.github.com/repos/abdonmorales/lc3-vscode/releases/latest";

/**
 * Fetch the latest release tag from GitHub and return the version string,
 * or null if the request fails for any reason.
 */
export async function fetchLatestVersion(): Promise<string | null> {
    try {
        const response = await fetch(RELEASES_API, {
            headers: { "User-Agent": "lc3-vscode-update-checker" },
        });
        if (!response.ok) return null;
        const data = await response.json() as { tag_name?: string };
        if (!data.tag_name) return null;
        return data.tag_name.replace(/^v/, ""); // strip leading "v"
    } catch {
        return null;
    }
}

/**
 * Main entry point — call this from activate().
 * Checks once per day; silently skips on network failure.
 */
export async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
    if (!shouldCheckToday(context.globalState)) return;
    await recordCheckDate(context.globalState);

    const ext = vscode.extensions.getExtension("ece306.lc3-assembly");
    if (!ext) return;
    const current: string = ext.packageJSON.version;

    const latest = await fetchLatestVersion();
    if (!latest) return;

    if (isNewer(current, latest)) {
        const choice = await vscode.window.showInformationMessage(
            `LC-3 Assembly: update available (v${latest})`,
            "Download",
            "Dismiss"
        );
        if (choice === "Download") {
            vscode.env.openExternal(
                vscode.Uri.parse("https://github.com/abdonmorales/lc3-vscode/releases/latest")
            );
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
//  OPTION 2 (DEAD CODE) — Private Extension Registry
//
//  Hosts a custom registry that speaks the VS Code Marketplace API,
//  enabling native auto-updates without publishing publicly.
//
//  To activate:
//    1. Stand up a server (e.g. Gitea package registry, or the
//       open-source "code-marketplace" project) on your UTCS host.
//    2. Uncomment the settings snippet below and distribute it to
//       students via a managed settings file or onboarding script.
//    3. Remove Option 1's checkForUpdates call from extension.ts —
//       VS Code will handle updates natively once the registry is
//       configured.
//
//  Student VS Code settings.json entry:
//  ─────────────────────────────────────────────────────────────────
//  "extensions.galleries": [
//    {
//      "name": "UT Internal",
//      "apiUrl": "https://www.cs.utexas.edu/~abdonm/vscode/gallery",
//      "itemUrl": "https://www.cs.utexas.edu/~abdonm/vscode/item"
//    }
//  ]
//  ─────────────────────────────────────────────────────────────────
//
//  Relevant projects:
//    - https://github.com/cdr/code-marketplace
//    - https://gitea.io (has a built-in VS Code extension registry)
//
// export async function configurePrivateRegistry(): Promise<void> {
//     // No extension-side code needed — configuration is purely in
//     // the user's VS Code settings and the server infrastructure.
//     // This stub is a placeholder for any future registry health
//     // checks or fallback logic you might want to add.
// }

// ═══════════════════════════════════════════════════════════════════
//  OPTION 3 (DEAD CODE) — Open VSX Registry
//
//  open-vsx.org is the open-source, vendor-neutral alternative to
//  the Microsoft marketplace. Publishing there is free and gives
//  real auto-updates without hosting your own server.
//
//  Trade-off: the extension becomes publicly visible. Fine for an
//  educational tool; not ideal if you want strict internal access.
//
//  To activate:
//    1. Create an account at https://open-vsx.org
//    2. Generate an access token.
//    3. Add the publish step below to release.yml (replace the
//       existing "Attach VSIX to release" step, or add it after):
//
//  ─────────────────────────────────────────────────────────────────
//  - name: Publish to Open VSX
//    env:
//      OVSX_PAT: ${{ secrets.OVSX_PAT }}
//    run: npx ovsx publish *.vsix -p $OVSX_PAT
//  ─────────────────────────────────────────────────────────────────
//
//  Students using VSCodium (or standard VS Code pointed at Open VSX)
//  get auto-updates for free — no manual .vsix installs needed.
//
//  Docs: https://github.com/eclipse/openvsx/wiki/Publishing-Extensions
//
