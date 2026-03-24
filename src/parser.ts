/**
 * LC-3 Assembly Line Parser
 * Pure parsing logic — no VS Code dependencies — so it can be unit tested.
 */

export const VALID_OPCODES = new Set([
  "ADD", "AND", "NOT",
  "LD", "LDI", "LDR", "LEA",
  "ST", "STI", "STR",
  "BR", "BRN", "BRZ", "BRP", "BRNZ", "BRNP", "BRZP", "BRNZP",
  "JMP", "JSR", "JSRR", "RET", "RTI",
  "TRAP",
  "HALT", "GETC", "OUT", "PUTS", "IN", "PUTSP",
]);

export const PSEUDO_OPS = new Set([".ORIG", ".END", ".FILL", ".BLKW", ".STRINGZ", ".EXTERNAL"]);

export interface ParsedLine {
  lineIndex: number;
  label?: string;
  opcode?: string;
  operands: string[];
  raw: string;
}

/**
 * Parse a single line of LC-3 assembly into its components.
 */
export function parseLine(raw: string, lineIndex: number): ParsedLine {
  // Remove comment
  const commentIdx = raw.indexOf(";");
  let code = commentIdx >= 0 ? raw.substring(0, commentIdx) : raw;
  code = code.trim();

  if (!code) return { lineIndex, operands: [], raw };

  let label: string | undefined;
  let opcode: string | undefined;
  let operands: string[] = [];

  // Handle .STRINGZ specially (operand is a quoted string)
  const stringzMatch = code.match(/^([A-Za-z_]\w*)?\s*(\.\s*STRINGZ)\s+(.*)/i);
  if (stringzMatch) {
    label = stringzMatch[1] || undefined;
    opcode = ".STRINGZ";
    operands = stringzMatch[3] ? [stringzMatch[3].trim()] : [];
    return { lineIndex, label, opcode, operands, raw };
  }

  // Tokenize
  const tokens = code.split(/[\s,]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return { lineIndex, operands: [], raw };

  let idx = 0;

  // Check if first token is a pseudo-op, opcode, or label
  const first = tokens[0].toUpperCase();
  if (first.startsWith(".") || VALID_OPCODES.has(first) || first.startsWith("BR")) {
    opcode = tokens[0];
    idx = 1;
  } else {
    // First token is a label
    label = tokens[0];
    idx = 1;
    if (idx < tokens.length) {
      const second = tokens[idx].toUpperCase();
      if (second.startsWith(".") || VALID_OPCODES.has(second) || second.startsWith("BR")) {
        opcode = tokens[idx];
        idx++;
      }
    }
  }

  operands = tokens.slice(idx);
  return { lineIndex, label, opcode, operands, raw };
}

/**
 * Parse all lines of LC-3 source text into structured representations.
 */
export function parseAllLines(lines: string[]): ParsedLine[] {
  return lines.map((raw, i) => parseLine(raw, i));
}

/**
 * Parse an immediate value token (#decimal, xHex, bBinary, or plain decimal).
 * Returns null if the token is not a valid immediate.
 */
export function parseImmediate(token: string): number | null {
  const t = token.trim();
  if (t.startsWith("#")) {
    const v = parseInt(t.substring(1), 10);
    return isNaN(v) ? null : v;
  }
  if (t.toUpperCase().startsWith("X")) {
    const v = parseInt(t.substring(1), 16);
    return isNaN(v) ? null : v;
  }
  if (t.toUpperCase().startsWith("B")) {
    const v = parseInt(t.substring(1), 2);
    return isNaN(v) ? null : v;
  }
  const v = parseInt(t, 10);
  return isNaN(v) ? null : v;
}

/**
 * Check if a token is a valid register (R0-R7).
 */
export function isValidRegister(token: string): boolean {
  return /^R[0-7]$/i.test(token.trim());
}

/**
 * Validate ALU operands (ADD/AND): DR, SR1, SR2/imm5.
 * Returns an array of error messages (empty if valid).
 */
export function validateALUOperands(opcode: string, operands: string[]): string[] {
  const errors: string[] = [];
  if (operands.length !== 3) {
    errors.push(`${opcode} requires 3 operands: DR, SR1, SR2/imm5.`);
    return errors;
  }
  if (!isValidRegister(operands[0])) {
    errors.push(`Expected register R0-R7 for DR, got "${operands[0].trim()}".`);
  }
  if (!isValidRegister(operands[1])) {
    errors.push(`Expected register R0-R7 for SR1, got "${operands[1].trim()}".`);
  }
  const third = operands[2].trim();
  if (third.toUpperCase().startsWith("R")) {
    if (!isValidRegister(third)) {
      errors.push(`Expected register R0-R7 for SR2, got "${third}".`);
    }
  } else if (third.startsWith("#") || third.toUpperCase().startsWith("X")) {
    const val = parseImmediate(third);
    if (val !== null && (val < -16 || val > 15)) {
      errors.push(`Immediate value ${third} is out of range for imm5 (-16 to 15).`);
    }
  } else {
    errors.push(`${opcode} third operand must be a register (R0-R7) or immediate (#n / xN). Labels are not valid here.`);
  }
  return errors;
}

/**
 * Validate offset6 range for LDR/STR.
 * Returns an array of error messages (empty if valid).
 */
export function validateOffset6(offset: string): string[] {
  const errors: string[] = [];
  const val = parseImmediate(offset.trim());
  if (val !== null && (val < -32 || val > 31)) {
    errors.push(`Offset ${offset} is out of range for offset6 (-32 to 31).`);
  }
  return errors;
}

/**
 * Validate TRAP vector range (0-255).
 * Returns an array of error messages (empty if valid).
 */
export function validateTrapVector(operand: string): string[] {
  const errors: string[] = [];
  const val = parseImmediate(operand.trim());
  if (val !== null && (val < 0 || val > 255)) {
    errors.push(`Trap vector ${operand} is out of range (x00 to xFF).`);
  }
  return errors;
}
