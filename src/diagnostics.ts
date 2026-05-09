import * as vscode from "vscode";
import {
  VALID_OPCODES,
  PSEUDO_OPS,
  ParsedLine,
  parseLine,
  parseImmediate,
} from "./parser";
import { layoutProgram, pcRelativeOffset } from "./addressLayout";
import { fitsSigned, signedRange } from "./numericHoverUtils";

/**
 * LC-3 Diagnostics Provider
 * Checks for common assembly errors students encounter:
 *   - Missing .ORIG / .END
 *   - Invalid register numbers
 *   - Immediate values out of range
 *   - Invalid operand counts
 *   - Undefined / unused labels
 *   - AND with label operand (register mode only)
 *   - offset6 out of range for LDR/STR
 */

export function createDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection
): void {
  const config = vscode.workspace.getConfiguration("lc3.diagnostics");
  if (!config.get<boolean>("enable", true)) {
    collection.clear();
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];
  const lines = parseAllLines(document);

  // Collect labels
  const definedLabels = new Map<string, number>();
  const referencedLabels = new Set<string>();

  let hasOrig = false;
  let hasEnd = false;

  for (const line of lines) {
    if (line.label) {
      definedLabels.set(line.label.toUpperCase(), line.lineIndex);
    }

    if (!line.opcode) continue;
    const op = line.opcode.toUpperCase();

    if (op === ".ORIG") hasOrig = true;
    if (op === ".END") hasEnd = true;

    // Track label references in operands
    for (const operand of line.operands) {
      const trimmed = operand.trim().toUpperCase();
      if (
        trimmed &&
        !trimmed.startsWith("R") &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith("X") &&
        !trimmed.startsWith("B") &&
        !trimmed.startsWith("-") &&
        !trimmed.startsWith("\"") &&
        !/^[0-9]/.test(trimmed)
      ) {
        referencedLabels.add(trimmed);
      }
    }

    // ── Validate specific opcodes ──
    if (op === "ADD" || op === "AND") {
      validateALU(line, diagnostics, document);
    } else if (op === "NOT") {
      validateNOT(line, diagnostics, document);
    } else if (op === "LD" || op === "LDI" || op === "ST" || op === "STI" || op === "LEA") {
      validatePCRelative(line, diagnostics, document);
    } else if (op === "LDR" || op === "STR") {
      validateBaseOffset(line, diagnostics, document);
    } else if (op === "JMP" || op === "JSRR") {
      validateSingleRegister(line, diagnostics, document);
    } else if (op === "TRAP") {
      validateTRAP(line, diagnostics, document);
    } else if (op === "RET" || op === "RTI" || op === "HALT" || op === "GETC" || op === "OUT" || op === "PUTS" || op === "IN" || op === "PUTSP") {
      if (line.operands.length > 0) {
        addDiag(diagnostics, document, line.lineIndex, `${op} takes no operands.`, vscode.DiagnosticSeverity.Error);
      }
    } else if (op.startsWith("BR")) {
      validateBranch(line, diagnostics, document);
    } else if (op === "JSR") {
      if (line.operands.length !== 1) {
        addDiag(diagnostics, document, line.lineIndex, "JSR requires exactly one label operand.", vscode.DiagnosticSeverity.Error);
      }
    } else if (op === ".ORIG") {
      validateORIG(line, diagnostics, document);
    } else if (op === ".FILL") {
      if (line.operands.length !== 1) {
        addDiag(diagnostics, document, line.lineIndex, ".FILL requires exactly one value.", vscode.DiagnosticSeverity.Error);
      }
    } else if (op === ".BLKW") {
      validateBLKW(line, diagnostics, document);
    } else if (op === ".STRINGZ") {
      // STRINGZ operand is the rest of the line in quotes — just check it exists
      if (line.operands.length === 0) {
        addDiag(diagnostics, document, line.lineIndex, '.STRINGZ requires a string in double quotes.', vscode.DiagnosticSeverity.Error);
      }
    } else if (op === ".END" || op === ".EXTERNAL") {
      // OK
    } else if (!VALID_OPCODES.has(op) && !PSEUDO_OPS.has(op)) {
      addDiag(diagnostics, document, line.lineIndex, `Unknown opcode "${line.opcode}".`, vscode.DiagnosticSeverity.Error);
    }
  }

  // Check for missing .ORIG / .END
  if (!hasOrig) {
    addDiag(diagnostics, document, 0, "Program is missing .ORIG directive.", vscode.DiagnosticSeverity.Warning);
  }
  if (!hasEnd) {
    const lastLine = document.lineCount - 1;
    addDiag(diagnostics, document, lastLine, "Program is missing .END directive.", vscode.DiagnosticSeverity.Warning);
  }

  // Warn about undefined label references
  for (const ref of referencedLabels) {
    if (!definedLabels.has(ref)) {
      // Find lines that reference it
      for (const line of lines) {
        for (const operand of line.operands) {
          if (operand.trim().toUpperCase() === ref) {
            addDiag(diagnostics, document, line.lineIndex, `Label "${ref}" is used but never defined.`, vscode.DiagnosticSeverity.Error);
          }
        }
      }
    }
  }

  // PC-relative offset range check (warning level — lc3as will still
  // catch these at assemble time; the diagnostic just surfaces them
  // earlier so students see *why* the offset doesn't fit).
  if (config.get<boolean>("warnPCRelativeOverflow", true)) {
    checkPCRelativeOffsets(lines, document, diagnostics);
  }

  // Warn about unused labels (optional)
  if (config.get<boolean>("warnUnusedLabels", true)) {
    for (const [label, lineIdx] of definedLabels) {
      if (!referencedLabels.has(label) && label !== ".ORIG" && label !== ".END") {
        // Don't warn for the first label if it's likely the program entry point
        const isFirstLabel = [...definedLabels.values()].indexOf(lineIdx) === 0;
        if (!isFirstLabel) {
          addDiag(diagnostics, document, lineIdx, `Label "${label}" is defined but never referenced.`, vscode.DiagnosticSeverity.Hint);
        }
      }
    }
  }

  collection.set(document.uri, diagnostics);
}

// ── Validation helpers ──────────────────────────────────────────────────

function validateALU(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  const op = line.opcode!.toUpperCase();
  if (line.operands.length !== 3) {
    addDiag(diags, doc, line.lineIndex, `${op} requires 3 operands: DR, SR1, SR2/imm5.`, vscode.DiagnosticSeverity.Error);
    return;
  }
  validateRegister(line.operands[0], line.lineIndex, diags, doc, "DR");
  validateRegister(line.operands[1], line.lineIndex, diags, doc, "SR1");

  const third = line.operands[2].trim();
  if (third.toUpperCase().startsWith("R")) {
    validateRegister(third, line.lineIndex, diags, doc, "SR2");
  } else if (third.startsWith("#") || third.startsWith("x") || third.startsWith("X")) {
    const val = parseImmediate(third);
    if (val !== null && (val < -16 || val > 15)) {
      addDiag(diags, doc, line.lineIndex, `Immediate value ${third} is out of range for imm5 (-16 to 15).`, vscode.DiagnosticSeverity.Error);
    }
  } else {
    // If it's a label, that's wrong for ADD/AND — they need register or immediate
    addDiag(diags, doc, line.lineIndex, `${op} third operand must be a register (R0-R7) or immediate (#n / xN). Labels are not valid here.`, vscode.DiagnosticSeverity.Error);
  }
}

function validateNOT(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  if (line.operands.length !== 2) {
    addDiag(diags, doc, line.lineIndex, "NOT requires exactly 2 operands: DR, SR.", vscode.DiagnosticSeverity.Error);
    return;
  }
  validateRegister(line.operands[0], line.lineIndex, diags, doc, "DR");
  validateRegister(line.operands[1], line.lineIndex, diags, doc, "SR");
}

function validatePCRelative(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  const op = line.opcode!.toUpperCase();
  if (line.operands.length !== 2) {
    addDiag(diags, doc, line.lineIndex, `${op} requires 2 operands: register, LABEL.`, vscode.DiagnosticSeverity.Error);
    return;
  }
  validateRegister(line.operands[0], line.lineIndex, diags, doc, op.startsWith("S") ? "SR" : "DR");
}

function validateBaseOffset(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  const op = line.opcode!.toUpperCase();
  if (line.operands.length !== 3) {
    addDiag(diags, doc, line.lineIndex, `${op} requires 3 operands: register, BaseR, offset6.`, vscode.DiagnosticSeverity.Error);
    return;
  }
  validateRegister(line.operands[0], line.lineIndex, diags, doc, op.startsWith("S") ? "SR" : "DR");
  validateRegister(line.operands[1], line.lineIndex, diags, doc, "BaseR");

  const offset = line.operands[2].trim();
  const val = parseImmediate(offset);
  if (val !== null && (val < -32 || val > 31)) {
    addDiag(diags, doc, line.lineIndex, `Offset ${offset} is out of range for offset6 (-32 to 31).`, vscode.DiagnosticSeverity.Error);
  }
}

function validateSingleRegister(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  const op = line.opcode!.toUpperCase();
  if (line.operands.length !== 1) {
    addDiag(diags, doc, line.lineIndex, `${op} requires exactly 1 register operand.`, vscode.DiagnosticSeverity.Error);
    return;
  }
  validateRegister(line.operands[0], line.lineIndex, diags, doc, "BaseR");
}

function validateBranch(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  if (line.operands.length !== 1) {
    addDiag(diags, doc, line.lineIndex, `${line.opcode} requires exactly one label operand.`, vscode.DiagnosticSeverity.Error);
  }
}

function validateTRAP(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  if (line.operands.length !== 1) {
    addDiag(diags, doc, line.lineIndex, "TRAP requires exactly one trapvect8 operand (e.g. x25).", vscode.DiagnosticSeverity.Error);
    return;
  }
  const val = parseImmediate(line.operands[0].trim());
  if (val !== null && (val < 0 || val > 255)) {
    addDiag(diags, doc, line.lineIndex, `Trap vector ${line.operands[0]} is out of range (x00 to xFF).`, vscode.DiagnosticSeverity.Error);
  }
}

function validateORIG(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  if (line.operands.length !== 1) {
    addDiag(diags, doc, line.lineIndex, ".ORIG requires exactly one address operand.", vscode.DiagnosticSeverity.Error);
  }
}

function validateBLKW(line: ParsedLine, diags: vscode.Diagnostic[], doc: vscode.TextDocument) {
  if (line.operands.length !== 1) {
    addDiag(diags, doc, line.lineIndex, ".BLKW requires exactly one positive integer.", vscode.DiagnosticSeverity.Error);
    return;
  }
  const val = parseInt(line.operands[0].trim(), 10);
  if (isNaN(val) || val <= 0) {
    addDiag(diags, doc, line.lineIndex, ".BLKW operand must be a positive integer.", vscode.DiagnosticSeverity.Error);
  }
}

function validateRegister(token: string, lineIdx: number, diags: vscode.Diagnostic[], doc: vscode.TextDocument, role: string) {
  const t = token.trim().toUpperCase();
  if (!/^R[0-7]$/.test(t)) {
    addDiag(diags, doc, lineIdx, `Expected register R0-R7 for ${role}, got "${token.trim()}".`, vscode.DiagnosticSeverity.Error);
  }
}


function addDiag(
  diags: vscode.Diagnostic[],
  doc: vscode.TextDocument,
  lineIdx: number,
  message: string,
  severity: vscode.DiagnosticSeverity
) {
  const range = doc.lineAt(lineIdx).range;
  diags.push(new vscode.Diagnostic(range, message, severity));
}

// Instructions whose label operand is PC-relative-9.
const PCREL9 = new Set([
  "BR", "BRN", "BRZ", "BRP", "BRNZ", "BRNP", "BRZP", "BRNZP",
  "LD", "LDI", "LEA", "ST", "STI",
]);

function checkPCRelativeOffsets(
  lines: ParsedLine[],
  doc: vscode.TextDocument,
  diags: vscode.Diagnostic[]
) {
  const layout = layoutProgram(lines);
  for (const entry of layout.instructions) {
    const op = entry.parsed.opcode?.toUpperCase();
    if (!op) continue;

    const isPCRel9 = PCREL9.has(op);
    const isJSR = op === "JSR";
    if (!isPCRel9 && !isJSR) continue;

    // The label is the LAST operand (BR has 1, LD/ST/etc. have 2).
    const labelTok = entry.parsed.operands[entry.parsed.operands.length - 1]?.trim();
    if (!labelTok) continue;
    const target = layout.labels.get(labelTok.toUpperCase());
    if (target === undefined) continue; // undefined-label diagnostic handled elsewhere

    const offset = pcRelativeOffset(entry.address, target);
    const bits = isJSR ? 11 : 9;
    if (!fitsSigned(offset, bits)) {
      addDiag(
        diags,
        doc,
        entry.lineIndex,
        `PC-relative offset to "${labelTok}" is ${offset}, which won't fit in ${bits} bits (range ${signedRange(bits)}). The assembler will reject this; consider an indirect jump (JMP via a register) or moving the label closer.`,
        vscode.DiagnosticSeverity.Warning
      );
    }
  }
}

// ── Line parser (delegates to parser.ts) ────────────────────────────────────────

function parseAllLines(doc: vscode.TextDocument): ParsedLine[] {
  const results: ParsedLine[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const raw = doc.lineAt(i).text;
    results.push(parseLine(raw, i));
  }
  return results;
}
