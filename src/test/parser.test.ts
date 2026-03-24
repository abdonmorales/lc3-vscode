import * as assert from "assert";
import {
  parseLine,
  parseAllLines,
  parseImmediate,
  isValidRegister,
  validateALUOperands,
  validateOffset6,
  validateTrapVector,
} from "../parser";

// ═══════════════════════════════════════════════════════════════════
//  parseLine
// ═══════════════════════════════════════════════════════════════════

describe("parseLine", () => {
  it("parses a simple opcode with register operands", () => {
    const result = parseLine("ADD R0, R1, R2", 0);
    assert.strictEqual(result.opcode, "ADD");
    assert.deepStrictEqual(result.operands, ["R0", "R1", "R2"]);
    assert.strictEqual(result.label, undefined);
  });

  it("parses a label followed by an opcode", () => {
    const result = parseLine("LOOP ADD R0, R1, #1", 5);
    assert.strictEqual(result.label, "LOOP");
    assert.strictEqual(result.opcode, "ADD");
    assert.deepStrictEqual(result.operands, ["R0", "R1", "#1"]);
    assert.strictEqual(result.lineIndex, 5);
  });

  it("parses a standalone label", () => {
    const result = parseLine("MYDATA ", 3);
    assert.strictEqual(result.label, "MYDATA");
    assert.strictEqual(result.opcode, undefined);
  });

  it("strips comments", () => {
    const result = parseLine("ADD R1, R2, R3 ; add them", 0);
    assert.strictEqual(result.opcode, "ADD");
    assert.deepStrictEqual(result.operands, ["R1", "R2", "R3"]);
  });

  it("handles empty lines", () => {
    const result = parseLine("", 0);
    assert.strictEqual(result.opcode, undefined);
    assert.strictEqual(result.label, undefined);
    assert.deepStrictEqual(result.operands, []);
  });

  it("handles comment-only lines", () => {
    const result = parseLine("; this is a comment", 0);
    assert.strictEqual(result.opcode, undefined);
    assert.deepStrictEqual(result.operands, []);
  });

  it("parses pseudo-ops", () => {
    const result = parseLine(".ORIG x3000", 0);
    assert.strictEqual(result.opcode, ".ORIG");
    assert.deepStrictEqual(result.operands, ["x3000"]);
  });

  it("parses .FILL with label", () => {
    const result = parseLine("COUNT .FILL #5", 10);
    assert.strictEqual(result.label, "COUNT");
    assert.strictEqual(result.opcode, ".FILL");
    assert.deepStrictEqual(result.operands, ["#5"]);
  });

  it("parses .STRINGZ with quoted string", () => {
    const result = parseLine('MSG .STRINGZ "Hello, world!"', 7);
    assert.strictEqual(result.label, "MSG");
    assert.strictEqual(result.opcode, ".STRINGZ");
    assert.strictEqual(result.operands.length, 1);
    assert.ok(result.operands[0].includes("Hello, world!"));
  });

  it("parses .BLKW", () => {
    const result = parseLine("ARRAY .BLKW 10", 8);
    assert.strictEqual(result.label, "ARRAY");
    assert.strictEqual(result.opcode, ".BLKW");
    assert.deepStrictEqual(result.operands, ["10"]);
  });

  it("parses branch instructions", () => {
    const result = parseLine("BRnzp LOOP", 2);
    assert.strictEqual(result.opcode, "BRnzp");
    assert.deepStrictEqual(result.operands, ["LOOP"]);
  });

  it("parses BR variant with label prefix", () => {
    const result = parseLine("SKIP BRz DONE", 4);
    assert.strictEqual(result.label, "SKIP");
    assert.strictEqual(result.opcode, "BRz");
    assert.deepStrictEqual(result.operands, ["DONE"]);
  });

  it("parses TRAP aliases", () => {
    const result = parseLine("HALT", 20);
    assert.strictEqual(result.opcode, "HALT");
    assert.deepStrictEqual(result.operands, []);
  });

  it("parses RET", () => {
    const result = parseLine("RET", 15);
    assert.strictEqual(result.opcode, "RET");
    assert.deepStrictEqual(result.operands, []);
  });

  it("parses JSR", () => {
    const result = parseLine("JSR MULTIPLY", 6);
    assert.strictEqual(result.opcode, "JSR");
    assert.deepStrictEqual(result.operands, ["MULTIPLY"]);
  });

  it("parses LDR with base+offset", () => {
    const result = parseLine("LDR R2, R3, #5", 0);
    assert.strictEqual(result.opcode, "LDR");
    assert.deepStrictEqual(result.operands, ["R2", "R3", "#5"]);
  });

  it("parses .END", () => {
    const result = parseLine(".END", 50);
    assert.strictEqual(result.opcode, ".END");
    assert.deepStrictEqual(result.operands, []);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  parseAllLines
// ═══════════════════════════════════════════════════════════════════

describe("parseAllLines", () => {
  it("parses a multi-line program", () => {
    const lines = [
      ".ORIG x3000",
      "ADD R0, R1, R2",
      "HALT",
      ".END",
    ];
    const result = parseAllLines(lines);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].opcode, ".ORIG");
    assert.strictEqual(result[1].opcode, "ADD");
    assert.strictEqual(result[2].opcode, "HALT");
    assert.strictEqual(result[3].opcode, ".END");
  });

  it("assigns correct lineIndex values", () => {
    const lines = ["", "; comment", "ADD R0, R0, #1"];
    const result = parseAllLines(lines);
    assert.strictEqual(result[0].lineIndex, 0);
    assert.strictEqual(result[1].lineIndex, 1);
    assert.strictEqual(result[2].lineIndex, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  parseImmediate
// ═══════════════════════════════════════════════════════════════════

describe("parseImmediate", () => {
  it("parses decimal with # prefix", () => {
    assert.strictEqual(parseImmediate("#10"), 10);
    assert.strictEqual(parseImmediate("#-5"), -5);
    assert.strictEqual(parseImmediate("#0"), 0);
  });

  it("parses hex with x prefix", () => {
    assert.strictEqual(parseImmediate("x3000"), 0x3000);
    assert.strictEqual(parseImmediate("xFF"), 0xFF);
    assert.strictEqual(parseImmediate("x0"), 0);
  });

  it("parses hex with X prefix (uppercase)", () => {
    assert.strictEqual(parseImmediate("X3000"), 0x3000);
  });

  it("parses binary with b prefix", () => {
    assert.strictEqual(parseImmediate("b1010"), 10);
    assert.strictEqual(parseImmediate("B1111"), 15);
  });

  it("parses plain decimal", () => {
    assert.strictEqual(parseImmediate("42"), 42);
  });

  it("returns null for non-numeric", () => {
    assert.strictEqual(parseImmediate("#abc"), null);
    assert.strictEqual(parseImmediate("LABEL"), null);
  });

  it("handles whitespace", () => {
    assert.strictEqual(parseImmediate("  #7  "), 7);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  isValidRegister
// ═══════════════════════════════════════════════════════════════════

describe("isValidRegister", () => {
  it("accepts R0 through R7", () => {
    for (let i = 0; i <= 7; i++) {
      assert.strictEqual(isValidRegister(`R${i}`), true);
    }
  });

  it("accepts lowercase", () => {
    assert.strictEqual(isValidRegister("r0"), true);
    assert.strictEqual(isValidRegister("r7"), true);
  });

  it("rejects R8 and above", () => {
    assert.strictEqual(isValidRegister("R8"), false);
    assert.strictEqual(isValidRegister("R9"), false);
  });

  it("rejects non-register tokens", () => {
    assert.strictEqual(isValidRegister("LOOP"), false);
    assert.strictEqual(isValidRegister("#5"), false);
    assert.strictEqual(isValidRegister(""), false);
  });

  it("handles whitespace", () => {
    assert.strictEqual(isValidRegister("  R3  "), true);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  validateALUOperands
// ═══════════════════════════════════════════════════════════════════

describe("validateALUOperands", () => {
  it("accepts valid register-mode ADD", () => {
    const errors = validateALUOperands("ADD", ["R0", "R1", "R2"]);
    assert.strictEqual(errors.length, 0);
  });

  it("accepts valid immediate-mode ADD", () => {
    const errors = validateALUOperands("ADD", ["R0", "R1", "#5"]);
    assert.strictEqual(errors.length, 0);
  });

  it("accepts boundary imm5 values", () => {
    assert.strictEqual(validateALUOperands("ADD", ["R0", "R0", "#15"]).length, 0);
    assert.strictEqual(validateALUOperands("ADD", ["R0", "R0", "#-16"]).length, 0);
  });

  it("rejects imm5 out of range", () => {
    const errors = validateALUOperands("ADD", ["R0", "R0", "#16"]);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("out of range"));
  });

  it("rejects negative imm5 out of range", () => {
    const errors = validateALUOperands("AND", ["R0", "R0", "#-17"]);
    assert.ok(errors.length > 0);
  });

  it("rejects wrong operand count", () => {
    const errors = validateALUOperands("ADD", ["R0", "R1"]);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("3 operands"));
  });

  it("rejects invalid registers", () => {
    const errors = validateALUOperands("ADD", ["R8", "R1", "R2"]);
    assert.ok(errors.length > 0);
  });

  it("rejects label as third operand", () => {
    const errors = validateALUOperands("AND", ["R0", "R1", "MYVAR"]);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes("Labels are not valid"));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  validateOffset6
// ═══════════════════════════════════════════════════════════════════

describe("validateOffset6", () => {
  it("accepts valid offset6 values", () => {
    assert.strictEqual(validateOffset6("#0").length, 0);
    assert.strictEqual(validateOffset6("#31").length, 0);
    assert.strictEqual(validateOffset6("#-32").length, 0);
  });

  it("rejects out-of-range offset6", () => {
    assert.ok(validateOffset6("#32").length > 0);
    assert.ok(validateOffset6("#-33").length > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  validateTrapVector
// ═══════════════════════════════════════════════════════════════════

describe("validateTrapVector", () => {
  it("accepts valid trap vectors", () => {
    assert.strictEqual(validateTrapVector("x20").length, 0);
    assert.strictEqual(validateTrapVector("x25").length, 0);
    assert.strictEqual(validateTrapVector("xFF").length, 0);
    assert.strictEqual(validateTrapVector("x00").length, 0);
  });

  it("rejects out-of-range trap vectors", () => {
    assert.ok(validateTrapVector("x100").length > 0);
    assert.ok(validateTrapVector("#256").length > 0);
  });
});
