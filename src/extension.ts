import * as vscode from "vscode";
import {
  LC3_INSTRUCTIONS,
  TRAP_ALIASES,
  PSEUDO_OPS,
  BRANCH_VARIANTS,
  lookupMnemonic,
  InstructionInfo,
} from "./instructionReference";
import { createDiagnostics } from "./diagnostics";
import { checkForUpdates } from "./updateChecker";
import { DEVICE_REGISTERS, lookupDeviceRegister } from "./deviceRegisters";
import { parseImmediate } from "./parser";
import { formatNumericLiteralHover } from "./numericHover";
import { newLabFileCommand } from "./labTemplate";
import { lc3TaskProvider, assembleCommand, runCommand } from "./lc3toolsTasks";
import { toggleHonorCodeCommand, registerHonorCodePromptHook } from "./honorCode";
import { registerMemoryMapView } from "./memoryMapView";

const LC3_SELECTOR: vscode.DocumentSelector = { language: "lc3", scheme: "file" };
const IMMEDIATE_PATTERN = /#-?\d+|[xX][0-9A-Fa-f]+|[bB][01]+/;

export function activate(context: vscode.ExtensionContext) {
  console.log("LC-3 Assembly extension activated");

  // Check for updates once per day (Option 1 — GitHub Releases)
  checkForUpdates(context);

  // ══════════════════════════════════════════════════════════════
  //  HOVER PROVIDER
  // ══════════════════════════════════════════════════════════════

  const hoverProvider = vscode.languages.registerHoverProvider(LC3_SELECTOR, {
    provideHover(document, position) {
      // 1. Numeric immediate at cursor (e.g. #-7, x3000, b1010) — show
      //    decimal/hex/binary breakdown plus encoding-field fit checks.
      const immRange = document.getWordRangeAtPosition(position, IMMEDIATE_PATTERN);
      if (immRange) {
        const tok = document.getText(immRange);
        const val = parseImmediate(tok);
        if (val !== null) {
          return new vscode.Hover(formatNumericLiteralHover(tok, val), immRange);
        }
      }

      const wordRange = document.getWordRangeAtPosition(position, /\.?[A-Za-z_]\w*/);
      if (!wordRange) return undefined;

      const word = document.getText(wordRange).toUpperCase();

      // 2. Device-register hover (KBSR, KBDR, DSR, DDR, MCR)
      const deviceReg = lookupDeviceRegister(word);
      if (deviceReg) {
        const md = new vscode.MarkdownString(deviceReg.description);
        md.isTrusted = true;
        return new vscode.Hover(md, wordRange);
      }

      // 3. General-purpose register hover
      if (/^R[0-7]$/.test(word)) {
        const regNum = word.charAt(1);
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${word}** — General Purpose Register ${regNum}\n\n`);
        md.appendMarkdown(
          `One of the LC-3's eight 16-bit registers (R0–R7).\n\n`
        );
        if (regNum === "0") {
          md.appendMarkdown(`> **Convention:** R0 is used for character I/O by TRAP routines (GETC, OUT, IN, PUTS).`);
        } else if (regNum === "6") {
          md.appendMarkdown(`> **Convention:** R6 is conventionally used as the stack pointer (SP).`);
        } else if (regNum === "7") {
          md.appendMarkdown(`> **Convention:** R7 is used by JSR/JSRR/TRAP to store the return address. Overwriting R7 before RET will break subroutine return.`);
        }
        return new vscode.Hover(md, wordRange);
      }

      const info = lookupMnemonic(word);
      if (!info) return undefined;

      return new vscode.Hover(formatInstructionHover(info), wordRange);
    },
  });

  // ══════════════════════════════════════════════════════════════
  //  COMPLETION PROVIDER
  // ══════════════════════════════════════════════════════════════

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    LC3_SELECTOR,
    {
      provideCompletionItems(document, position) {
        const items: vscode.CompletionItem[] = [];

        for (const [name, info] of Object.entries(LC3_INSTRUCTIONS)) {
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
          item.detail = info.brief;
          item.documentation = new vscode.MarkdownString(info.description);
          item.insertText = createInsertSnippet(name, info);
          items.push(item);
        }
        for (const [name, desc] of Object.entries(BRANCH_VARIANTS)) {
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
          item.detail = desc;
          item.insertText = new vscode.SnippetString(`${name} \${1:LABEL}`);
          items.push(item);
        }
        for (const [name, info] of Object.entries(TRAP_ALIASES)) {
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
          item.detail = info.brief;
          item.documentation = new vscode.MarkdownString(info.description);
          items.push(item);
        }
        for (const [name, info] of Object.entries(PSEUDO_OPS)) {
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
          item.detail = info.brief;
          item.documentation = new vscode.MarkdownString(info.description);
          item.insertText = createPseudoOpSnippet(name);
          items.push(item);
        }
        for (let i = 0; i <= 7; i++) {
          const item = new vscode.CompletionItem(`R${i}`, vscode.CompletionItemKind.Variable);
          item.detail = `General purpose register ${i}`;
          if (i === 0) item.documentation = "Used for character I/O by TRAP routines.";
          if (i === 6) item.documentation = "Convention: stack pointer (SP).";
          if (i === 7) item.documentation = "Stores return address for JSR/JSRR/TRAP.";
          items.push(item);
        }
        for (const dev of DEVICE_REGISTERS) {
          const item = new vscode.CompletionItem(dev.name, vscode.CompletionItemKind.Constant);
          item.detail = dev.brief;
          item.documentation = new vscode.MarkdownString(dev.description);
          items.push(item);
        }
        for (let i = 0; i < document.lineCount; i++) {
          const line = document.lineAt(i).text;
          const match = line.match(/^([A-Za-z_]\w*)\s/);
          if (match) {
            const labelName = match[1].toUpperCase();
            if (
              !Object.keys(LC3_INSTRUCTIONS).includes(labelName) &&
              !Object.keys(TRAP_ALIASES).includes(labelName) &&
              !Object.keys(BRANCH_VARIANTS).includes(labelName)
            ) {
              const item = new vscode.CompletionItem(match[1], vscode.CompletionItemKind.Reference);
              item.detail = `Label (line ${i + 1})`;
              items.push(item);
            }
          }
        }

        return items;
      },
    },
    ".",
  );

  // ══════════════════════════════════════════════════════════════
  //  SIGNATURE HELP PROVIDER
  // ══════════════════════════════════════════════════════════════

  const signatureProvider = vscode.languages.registerSignatureHelpProvider(
    LC3_SELECTOR,
    {
      provideSignatureHelp(document, position) {
        const lineText = document.lineAt(position.line).text;
        const beforeCursor = lineText.substring(0, position.character);
        const match = beforeCursor.match(/^\s*(?:[A-Za-z_]\w*\s+)?(\.\w+|[A-Za-z]+)/);
        if (!match) return undefined;

        const opcode = match[1].toUpperCase();
        const info = lookupMnemonic(opcode);
        if (!info || info.syntax.length === 0) return undefined;

        const sigHelp = new vscode.SignatureHelp();
        for (const syn of info.syntax) {
          const sig = new vscode.SignatureInformation(syn, info.brief);
          sigHelp.signatures.push(sig);
        }

        const afterOpcode = beforeCursor.substring(match.index! + match[0].length);
        const commaCount = (afterOpcode.match(/,/g) || []).length;
        sigHelp.activeSignature = 0;
        sigHelp.activeParameter = commaCount;

        return sigHelp;
      },
    },
    ",",
    " "
  );

  // ══════════════════════════════════════════════════════════════
  //  DIAGNOSTICS
  // ══════════════════════════════════════════════════════════════

  const diagnosticCollection = vscode.languages.createDiagnosticCollection("lc3");
  const runDiagnostics = (doc: vscode.TextDocument) => {
    if (doc.languageId === "lc3") createDiagnostics(doc, diagnosticCollection);
  };
  vscode.workspace.textDocuments.forEach(runDiagnostics);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(runDiagnostics),
    vscode.workspace.onDidSaveTextDocument(runDiagnostics),
    vscode.workspace.onDidChangeTextDocument((e) => runDiagnostics(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri))
  );

  // ══════════════════════════════════════════════════════════════
  //  DOCUMENT SYMBOL / DEFINITION / REFERENCE PROVIDERS
  // ══════════════════════════════════════════════════════════════

  const symbolProvider = vscode.languages.registerDocumentSymbolProvider(LC3_SELECTOR, {
    provideDocumentSymbols(document) {
      const symbols: vscode.DocumentSymbol[] = [];
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const match = line.text.match(/^([A-Za-z_]\w*)\s/);
        if (match) {
          const name = match[1];
          const rest = line.text.substring(match[0].length).trim().toUpperCase();
          let kind = vscode.SymbolKind.Function;
          if (rest.startsWith(".FILL") || rest.startsWith(".BLKW") || rest.startsWith(".STRINGZ")) {
            kind = vscode.SymbolKind.Variable;
          }
          symbols.push(new vscode.DocumentSymbol(name, rest.split(";")[0].trim(), kind, line.range, line.range));
        }
      }
      return symbols;
    },
  });

  const definitionProvider = vscode.languages.registerDefinitionProvider(LC3_SELECTOR, {
    provideDefinition(document, position) {
      const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
      if (!wordRange) return undefined;
      const word = document.getText(wordRange);
      if (lookupMnemonic(word.toUpperCase())) return undefined;
      if (/^R[0-7]$/i.test(word)) return undefined;
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const match = line.text.match(/^([A-Za-z_]\w*)\s/);
        if (match && match[1].toUpperCase() === word.toUpperCase()) {
          return new vscode.Location(document.uri, line.range.start);
        }
      }
      return undefined;
    },
  });

  const referenceProvider = vscode.languages.registerReferenceProvider(LC3_SELECTOR, {
    provideReferences(document, position) {
      const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);
      if (!wordRange) return undefined;
      const word = document.getText(wordRange).toUpperCase();
      if (lookupMnemonic(word)) return undefined;
      if (/^R[0-7]$/i.test(word)) return undefined;
      const locations: vscode.Location[] = [];
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const commentIdx = line.text.indexOf(";");
        const code = commentIdx >= 0 ? line.text.substring(0, commentIdx) : line.text;
        let match;
        while ((match = regex.exec(code)) !== null) {
          const start = new vscode.Position(i, match.index);
          const end = new vscode.Position(i, match.index + match[0].length);
          locations.push(new vscode.Location(document.uri, new vscode.Range(start, end)));
        }
      }
      return locations;
    },
  });

  // ══════════════════════════════════════════════════════════════
  //  COMMANDS / TASKS / HONOR-CODE / MEMORY MAP
  // ══════════════════════════════════════════════════════════════

  const newLabFile = vscode.commands.registerCommand("lc3.newLabFile", newLabFileCommand);
  const assemble = vscode.commands.registerCommand("lc3.assembleCurrent", assembleCommand);
  const run = vscode.commands.registerCommand("lc3.runCurrent", runCommand);
  const honorCode = vscode.commands.registerCommand("lc3.toggleHonorCode", toggleHonorCodeCommand);
  const taskProvider = vscode.tasks.registerTaskProvider("lc3", lc3TaskProvider);
  const honorCodeHook = registerHonorCodePromptHook(context);
  const memoryMap = registerMemoryMapView(context);

  context.subscriptions.push(
    hoverProvider,
    completionProvider,
    signatureProvider,
    diagnosticCollection,
    symbolProvider,
    definitionProvider,
    referenceProvider,
    newLabFile,
    assemble,
    run,
    honorCode,
    taskProvider,
    honorCodeHook,
    ...memoryMap
  );
}

export function deactivate() {}

// ════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

function formatInstructionHover(info: InstructionInfo): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  const catLabel: Record<string, string> = {
    operate: "Operate",
    data_movement: "Data Movement",
    control: "Control",
    pseudo_op: "Assembler Directive",
    trap_alias: "TRAP Service Routine",
  };
  md.appendMarkdown(`### ${info.mnemonic} — ${info.brief}\n`);
  md.appendMarkdown(`*${catLabel[info.category]}*`);
  if (info.setsCC) md.appendMarkdown(` · **Sets condition codes** (N, Z, P)`);
  md.appendMarkdown(`\n\n`);
  md.appendMarkdown(`**Syntax:**\n`);
  for (const s of info.syntax) md.appendMarkdown(`\`${s}\`\n\n`);
  const showEncoding = vscode.workspace.getConfiguration("lc3.hover").get<boolean>("showEncoding", true);
  if (showEncoding) {
    md.appendMarkdown(`**Encoding:**\n`);
    md.appendMarkdown("```\n" + info.encoding + "\n```\n\n");
  }
  md.appendMarkdown(`---\n\n${info.description}\n\n`);
  md.appendMarkdown(`**Example:**\n\n`);
  md.appendMarkdown("```lc3\n" + info.example + "\n```");
  return md;
}

function createInsertSnippet(name: string, info: InstructionInfo): vscode.SnippetString {
  switch (name) {
    case "ADD":
    case "AND":
      return new vscode.SnippetString(`${name} \${1:R0}, \${2:R1}, \${3:R2}`);
    case "NOT":
      return new vscode.SnippetString(`${name} \${1:R0}, \${2:R1}`);
    case "LD":
    case "LDI":
    case "LEA":
      return new vscode.SnippetString(`${name} \${1:R0}, \${2:LABEL}`);
    case "LDR":
      return new vscode.SnippetString(`${name} \${1:R0}, \${2:R1}, #\${3:0}`);
    case "ST":
    case "STI":
      return new vscode.SnippetString(`${name} \${1:R0}, \${2:LABEL}`);
    case "STR":
      return new vscode.SnippetString(`${name} \${1:R0}, \${2:R1}, #\${3:0}`);
    case "BR":
      return new vscode.SnippetString(`BR\${1|n,z,p,nz,np,zp,nzp|} \${2:LABEL}`);
    case "JMP":
      return new vscode.SnippetString(`JMP \${1:R0}`);
    case "JSR":
      return new vscode.SnippetString(`JSR \${1:LABEL}`);
    case "JSRR":
      return new vscode.SnippetString(`JSRR \${1:R0}`);
    case "TRAP":
      return new vscode.SnippetString(`TRAP x\${1:25}`);
    default:
      return new vscode.SnippetString(name);
  }
}

function createPseudoOpSnippet(name: string): vscode.SnippetString {
  switch (name) {
    case ".ORIG":
      return new vscode.SnippetString(`.ORIG x\${1:3000}`);
    case ".FILL":
      return new vscode.SnippetString(`.FILL \${1:x0000}`);
    case ".BLKW":
      return new vscode.SnippetString(`.BLKW \${1:1}`);
    case ".STRINGZ":
      return new vscode.SnippetString(`.STRINGZ "\${1:}"`);
    case ".EXTERNAL":
      return new vscode.SnippetString(`.EXTERNAL \${1:LABEL}`);
    default:
      return new vscode.SnippetString(name);
  }
}
