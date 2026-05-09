import * as vscode from "vscode";
import { layoutProgram, LayoutResult, InstructionLayout } from "./addressLayout";
import { parseLine, ParsedLine } from "./parser";
import { DEVICE_REGISTERS } from "./deviceRegisters";

// LC-3 Memory Map — a side-bar tree that shows where each label and data
// blob lands in 16-bit address space. Useful in lecture demos (visualise
// what ".ORIG x3000" actually means) and during debugging when an offset
// looks wrong. Updates whenever the active editor's content changes.
//
// Tree shape:
//   Program (.ORIG x3000 — x300A)
//   ├── x3000  START         ADD R0, R0, #1
//   ├── x3001  LOOP          ADD R0, R0, #-1
//   └── ...
//   Data
//   ├── x300A  COUNT         .FILL #0
//   └── x300B  GREETING      .STRINGZ "Hi"   (3 words)
//   Device Registers
//   ├── xFE00  KBSR
//   └── ...

const hex4 = (n: number) => "x" + n.toString(16).toUpperCase().padStart(4, "0");

type NodeKind = "section" | "instruction" | "data" | "device";

interface MapNode {
    kind: NodeKind;
    label: string;
    description?: string;
    tooltip?: string;
    address?: number;
    children?: MapNode[];
    /** Source line index, for click-to-navigate. */
    lineIndex?: number;
}

function isDataDirective(op: string | undefined): boolean {
    if (!op) return false;
    const u = op.toUpperCase();
    return u === ".FILL" || u === ".BLKW" || u === ".STRINGZ";
}

function buildTree(layout: LayoutResult, lines: ParsedLine[]): MapNode[] {
    const code: MapNode[] = [];
    const data: MapNode[] = [];

    for (const entry of layout.instructions) {
        const op = entry.parsed.opcode?.toUpperCase();
        const labelText = entry.parsed.label ?? "";
        const operands = entry.parsed.operands.join(", ");
        const summary = `${op ?? ""}${operands ? " " + operands : ""}`;
        const node: MapNode = {
            kind: isDataDirective(op) ? "data" : "instruction",
            label: hex4(entry.address),
            description: labelText ? `${labelText}  ${summary}` : summary,
            tooltip: `${hex4(entry.address)}  ${entry.parsed.raw.trim()}`,
            address: entry.address,
            lineIndex: entry.lineIndex,
        };
        (isDataDirective(op) ? data : code).push(node);
    }

    const referencedNames = new Set<string>();
    for (const line of lines) {
        for (const op of line.operands) {
            referencedNames.add(op.trim().toUpperCase());
        }
    }
    const devices: MapNode[] = DEVICE_REGISTERS
        .filter((d) => referencedNames.has(d.name))
        .map((d) => ({
            kind: "device",
            label: hex4(d.address),
            description: `${d.name}  ${d.brief.replace(/ \([^)]+\)/, "")}`,
            tooltip: d.brief,
            address: d.address,
        }));

    const sections: MapNode[] = [];
    if (code.length > 0) {
        sections.push({
            kind: "section",
            label: "Program",
            description: `${hex4(layout.origin)}–${hex4(layout.end - 1)}  (${layout.end - layout.origin} words)`,
            children: code,
        });
    }
    if (data.length > 0) {
        sections.push({
            kind: "section",
            label: "Data",
            description: `${data.length} entries`,
            children: data,
        });
    }
    if (devices.length > 0) {
        sections.push({
            kind: "section",
            label: "Device Registers (referenced)",
            description: `${devices.length}`,
            children: devices,
        });
    }
    return sections;
}

class MemoryMapProvider implements vscode.TreeDataProvider<MapNode> {
    private _onDidChange = new vscode.EventEmitter<MapNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    private nodes: MapNode[] = [];
    private currentDoc: vscode.TextDocument | null = null;

    refresh(doc: vscode.TextDocument | null): void {
        this.currentDoc = doc;
        if (!doc || doc.languageId !== "lc3") {
            this.nodes = [];
        } else {
            const lines: ParsedLine[] = [];
            for (let i = 0; i < doc.lineCount; i++) {
                lines.push(parseLine(doc.lineAt(i).text, i));
            }
            this.nodes = buildTree(layoutProgram(lines), lines);
        }
        this._onDidChange.fire();
    }

    getCurrentDocument(): vscode.TextDocument | null {
        return this.currentDoc;
    }

    getTreeItem(node: MapNode): vscode.TreeItem {
        const item = new vscode.TreeItem(
            node.label,
            node.kind === "section"
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None
        );
        item.description = node.description;
        item.tooltip = node.tooltip;

        if (node.kind === "instruction") item.iconPath = new vscode.ThemeIcon("symbol-method");
        else if (node.kind === "data") item.iconPath = new vscode.ThemeIcon("symbol-variable");
        else if (node.kind === "device") item.iconPath = new vscode.ThemeIcon("circuit-board");
        else if (node.kind === "section") item.iconPath = new vscode.ThemeIcon("symbol-namespace");

        if (typeof node.lineIndex === "number") {
            item.command = {
                command: "lc3.revealMemoryMapEntry",
                title: "Reveal in Editor",
                arguments: [node.lineIndex],
            };
        }
        return item;
    }

    getChildren(node?: MapNode): MapNode[] {
        if (!node) return this.nodes;
        return node.children ?? [];
    }
}

export function registerMemoryMapView(context: vscode.ExtensionContext): vscode.Disposable[] {
    const provider = new MemoryMapProvider();
    const view = vscode.window.createTreeView("lc3MemoryMap", { treeDataProvider: provider });

    const refreshFromActive = () => provider.refresh(vscode.window.activeTextEditor?.document ?? null);
    refreshFromActive();

    const disposables: vscode.Disposable[] = [
        view,
        vscode.window.onDidChangeActiveTextEditor(refreshFromActive),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document === provider.getCurrentDocument()) provider.refresh(e.document);
        }),
        vscode.commands.registerCommand("lc3.revealMemoryMapEntry", async (lineIndex: number) => {
            const doc = provider.getCurrentDocument();
            if (!doc) return;
            const editor = await vscode.window.showTextDocument(doc, { preserveFocus: true });
            const range = doc.lineAt(lineIndex).range;
            editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
            editor.selection = new vscode.Selection(range.start, range.start);
        }),
    ];
    return disposables;
}
