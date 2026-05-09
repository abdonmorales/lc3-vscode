import * as vscode from "vscode";

// "ECE 306: New Lab File" — opens a new untitled .asm document with
// the standard course header. Mirrors the `ece306_lab` snippet, but
// available from the command palette so students can start a brand-new
// file without typing a snippet prefix into a blank buffer first.

function buildTemplate(): string {
    const today = new Date().toISOString().slice(0, 10);
    return [
        ";==============================================================",
        "; ECE 306 — The University of Texas at Austin",
        "; Name:           ${1:Last, First}",
        "; UT EID:         ${2:abc1234}",
        "; Lab/Assignment: ${3:Lab N}",
        `; Date:           \${4:${today}}`,
        ";",
        "; Description:    ${5:What this program does}",
        ";==============================================================",
        "",
        ".ORIG ${6:x3000}",
        "",
        "${0:; Your code here}",
        "",
        "HALT",
        "",
        "; ─── Data section ─────────────────────────────────────────────",
        "",
        ".END",
        "",
    ].join("\n");
}

export async function newLabFileCommand(): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
        language: "lc3",
        content: "",
    });
    const editor = await vscode.window.showTextDocument(doc);
    // Use insertSnippet so the placeholders are tab-stops the student
    // can step through.
    await editor.insertSnippet(new vscode.SnippetString(buildTemplate()));
}
