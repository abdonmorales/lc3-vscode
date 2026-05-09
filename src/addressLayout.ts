// Compute the memory address of each instruction in an LC-3 source file.
// The assembler does this implicitly — every instruction or .FILL takes
// one word, .BLKW takes N words, .STRINGZ takes len+1 words (including
// the null terminator). The layout is needed for:
//
//   1. The PC-relative offset linter (BR/LD/.../JSR can only reach so far).
//   2. The memory-map sidebar.
//   3. Future "what does this branch encode as" hovers.
//
// Pure logic (no vscode dependency) so it's straightforward to unit test.

import { ParsedLine, parseImmediate } from "./parser";

export interface InstructionLayout {
    lineIndex: number;
    /** Memory address of this instruction or data word. */
    address: number;
    /** How many words this entry occupies (BLKW/STRINGZ can be > 1). */
    size: number;
    parsed: ParsedLine;
}

export interface LayoutResult {
    /** All assembled instructions/data, in source order. */
    instructions: InstructionLayout[];
    /** Label → address. Labels are uppercased. */
    labels: Map<string, number>;
    /** First .ORIG seen. Defaults to 0x3000 if none was specified. */
    origin: number;
    /** Highest used address + 1 (exclusive). Useful for the memory map. */
    end: number;
}

const DEFAULT_ORIGIN = 0x3000;

/**
 * Walk parsed lines and assign addresses. Stops counting after the first
 * `.END` (subsequent lines are ignored — same behavior as lc3as).
 */
export function layoutProgram(lines: ParsedLine[]): LayoutResult {
    const instructions: InstructionLayout[] = [];
    const labels = new Map<string, number>();
    let pc: number | null = null;
    let origin = DEFAULT_ORIGIN;

    for (const line of lines) {
        const op = line.opcode?.toUpperCase();

        if (op === ".ORIG") {
            const addr = parseImmediate((line.operands[0] ?? "").trim());
            pc = addr ?? DEFAULT_ORIGIN;
            origin = pc;
            continue;
        }

        if (op === ".END") break;
        if (pc === null) continue;

        if (line.label) {
            labels.set(line.label.toUpperCase(), pc);
        }

        if (!line.opcode) continue;

        const size = entrySize(op!, line);
        if (size > 0) {
            instructions.push({ lineIndex: line.lineIndex, address: pc, size, parsed: line });
            pc += size;
        }
    }

    return {
        instructions,
        labels,
        origin,
        end: pc ?? origin,
    };
}

function entrySize(op: string, line: ParsedLine): number {
    if (op === ".BLKW") {
        const n = parseInt((line.operands[0] ?? "").trim(), 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }
    if (op === ".STRINGZ") {
        // operand is the rest-of-line including the quotes
        const raw = line.operands[0] ?? "";
        const m = raw.match(/^"((?:[^"\\]|\\.)*)"/);
        if (!m) return 0;
        // Each character becomes one word, plus the null terminator. We
        // don't expand escape sequences — close enough for layout, since
        // \n / \t / \\ each shrink to one character anyway.
        const literal = m[1].replace(/\\(.)/g, "$1");
        return literal.length + 1;
    }
    if (op === ".FILL") return 1;
    if (op === ".EXTERNAL" || op === ".END" || op === ".ORIG") return 0;
    return 1; // any real instruction
}

/**
 * Compute the PC-relative offset that a given branch/load/store at
 * `instrAddress` would encode to reach `targetAddress`. The LC-3 PC
 * has already been incremented by the time the offset is added, so
 * the formula is `target - (instr + 1)`.
 */
export function pcRelativeOffset(instrAddress: number, targetAddress: number): number {
    return targetAddress - (instrAddress + 1);
}
