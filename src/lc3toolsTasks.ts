import * as vscode from "vscode";
import * as path from "path";

// Minimal lc3tools integration: two commands ("assemble current",
// "run current") that shell out to `lc3as` and `lc3sim`. We do not
// bundle the simulator — students install lc3tools separately and
// either put it on PATH or set `lc3.lc3tools.binPath`.
//
// Why a task provider in addition to commands? Because if a student
// (or an instructor in a starter repo) writes a tasks.json with
// `"type": "lc3", "task": "assemble"`, VS Code's built-in task UI
// will round-trip it through this provider — same code path, no
// duplicate logic.

interface Lc3Task extends vscode.TaskDefinition {
    type: "lc3";
    task: "assemble" | "run";
    file?: string;
}

function configuredBin(name: string): string {
    const dir = vscode.workspace
        .getConfiguration("lc3.lc3tools")
        .get<string>("binPath", "");
    return dir ? path.join(dir, name) : name;
}

function lc3sim(): string {
    const useGUI = vscode.workspace
        .getConfiguration("lc3.lc3tools")
        .get<boolean>("useGUI", false);
    return configuredBin(useGUI ? "lc3sim-gui" : "lc3sim");
}

function activeAsmFile(): string | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "lc3") return null;
    return editor.document.uri.fsPath;
}

function buildTask(def: Lc3Task, asmFile: string): vscode.Task {
    const cwd = path.dirname(asmFile);
    const stem = asmFile.replace(/\.(asm|lc3|s)$/i, "");
    const objFile = stem + ".obj";

    let exec: vscode.ShellExecution;
    let displayName: string;
    if (def.task === "assemble") {
        // `lc3as foo.asm` produces foo.obj and foo.sym in the same dir.
        exec = new vscode.ShellExecution(configuredBin("lc3as"), [path.basename(asmFile)], { cwd });
        displayName = `Assemble ${path.basename(asmFile)}`;
    } else {
        // `lc3sim foo.obj` runs the simulator. Prefer the GUI if the
        // user opted in via lc3.lc3tools.useGUI.
        exec = new vscode.ShellExecution(lc3sim(), [path.basename(objFile)], { cwd });
        displayName = `Run ${path.basename(objFile)}`;
    }

    const task = new vscode.Task(
        def,
        vscode.TaskScope.Workspace,
        displayName,
        "lc3",
        exec,
        ["$lc3"]
    );
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        focus: false,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
    };
    return task;
}

export const lc3TaskProvider: vscode.TaskProvider = {
    provideTasks(): vscode.Task[] {
        const file = activeAsmFile();
        if (!file) return [];
        return [
            buildTask({ type: "lc3", task: "assemble" }, file),
            buildTask({ type: "lc3", task: "run" }, file),
        ];
    },
    resolveTask(task): vscode.Task | undefined {
        const def = task.definition as Lc3Task;
        const file = def.file
            ? path.resolve(def.file)
            : activeAsmFile();
        if (!file) return undefined;
        return buildTask(def, file);
    },
};

async function runActiveTask(kind: "assemble" | "run"): Promise<void> {
    const file = activeAsmFile();
    if (!file) {
        vscode.window.showWarningMessage(
            "LC-3: open a .asm file in the active editor first."
        );
        return;
    }
    if (kind === "run") {
        // Auto-assemble on run if the .obj is missing or older than the .asm.
        const stem = file.replace(/\.(asm|lc3|s)$/i, "");
        const objUri = vscode.Uri.file(stem + ".obj");
        try {
            const [asmStat, objStat] = await Promise.all([
                vscode.workspace.fs.stat(vscode.Uri.file(file)),
                vscode.workspace.fs.stat(objUri),
            ]);
            if (asmStat.mtime > objStat.mtime) {
                await vscode.tasks.executeTask(
                    buildTask({ type: "lc3", task: "assemble" }, file)
                );
            }
        } catch {
            // .obj didn't exist — assemble first.
            await vscode.tasks.executeTask(
                buildTask({ type: "lc3", task: "assemble" }, file)
            );
        }
    }
    await vscode.tasks.executeTask(buildTask({ type: "lc3", task: kind }, file));
}

export const assembleCommand = () => runActiveTask("assemble");
export const runCommand = () => runActiveTask("run");
