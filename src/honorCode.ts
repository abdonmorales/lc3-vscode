import * as vscode from "vscode";

// UT Austin honor-code block helper. Two surfaces:
//
//   1. The `lc3.toggleHonorCode` command — manual insert at the top of
//      the active editor.
//   2. An onWillSave hook that fires on the first save of any LC-3 file
//      in the workspace, gated by the `lc3.honorCode.promptOnFirstSave`
//      setting (default: "off"). Per-workspace state remembers files
//      that have already been prompted so we never nag twice.

const PROMPTED_KEY = "lc3.honorCode.promptedFiles";

function honorCodeText(): string {
    return vscode.workspace.getConfiguration("lc3.honorCode").get<string>("text", "").trimEnd();
}

function alreadyContainsBlock(doc: vscode.TextDocument): boolean {
    const block = honorCodeText();
    if (!block) return true; // empty config: nothing to insert
    const head = doc.getText(new vscode.Range(0, 0, Math.min(doc.lineCount, 30), 0));
    // Match on the first non-blank, non-comment-prefix line of the block.
    const firstSubstantive = block.split("\n").map((l) => l.replace(/^;\s*/, "").trim()).find((l) => l.length > 0);
    return !!firstSubstantive && head.includes(firstSubstantive);
}

function insertBlock(editor: vscode.TextEditor): Thenable<boolean> {
    const block = honorCodeText();
    if (!block) return Promise.resolve(false);
    return editor.edit((e) => e.insert(new vscode.Position(0, 0), block + "\n\n"));
}

export async function toggleHonorCodeCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "lc3") {
        vscode.window.showWarningMessage(
            "LC-3: open a .asm file in the active editor first."
        );
        return;
    }
    if (alreadyContainsBlock(editor.document)) {
        vscode.window.showInformationMessage("LC-3: honor-code block already present.");
        return;
    }
    await insertBlock(editor);
}

export function registerHonorCodePromptHook(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.workspace.onWillSaveTextDocument((event) => {
        if (event.document.languageId !== "lc3") return;
        if (event.document.isUntitled) return;

        const mode = vscode.workspace
            .getConfiguration("lc3.honorCode")
            .get<string>("promptOnFirstSave", "off");
        if (mode === "off") return;

        const prompted = context.workspaceState.get<string[]>(PROMPTED_KEY, []);
        const key = event.document.uri.toString();
        if (prompted.includes(key)) return;
        if (alreadyContainsBlock(event.document)) {
            // Already there from a template — record so we never prompt again.
            context.workspaceState.update(PROMPTED_KEY, [...prompted, key]);
            return;
        }

        // Defer the actual prompt so it doesn't block the save.
        event.waitUntil(
            (async () => {
                context.workspaceState.update(PROMPTED_KEY, [...prompted, key]);
                if (mode === "always") {
                    return [vscode.TextEdit.insert(new vscode.Position(0, 0), honorCodeText() + "\n\n")];
                }
                const choice = await vscode.window.showInformationMessage(
                    "Insert the UT honor-code block at the top of this file?",
                    "Yes",
                    "No",
                    "Don't ask again"
                );
                if (choice === "Yes") {
                    return [vscode.TextEdit.insert(new vscode.Position(0, 0), honorCodeText() + "\n\n")];
                }
                if (choice === "Don't ask again") {
                    await vscode.workspace
                        .getConfiguration("lc3.honorCode")
                        .update("promptOnFirstSave", "off", vscode.ConfigurationTarget.Global);
                }
                return [];
            })()
        );
    });
}
