import * as assert from "assert";
import {
  LC3_INSTRUCTIONS,
  TRAP_ALIASES,
  PSEUDO_OPS,
  BRANCH_VARIANTS,
  getAllMnemonics,
  lookupMnemonic,
  InstructionInfo,
} from "../instructionReference";

// ═══════════════════════════════════════════════════════════════════
//  Data integrity
// ═══════════════════════════════════════════════════════════════════

describe("LC3_INSTRUCTIONS", () => {
  it("contains all 15 core opcodes", () => {
    const expected = [
      "ADD", "AND", "NOT",
      "LD", "LDI", "LDR", "LEA",
      "ST", "STI", "STR",
      "BR", "JMP", "JSR", "JSRR",
      "RET", "RTI", "TRAP",
    ];
    for (const op of expected) {
      assert.ok(op in LC3_INSTRUCTIONS, `Missing opcode: ${op}`);
    }
  });

  it("every instruction has required fields", () => {
    for (const [name, info] of Object.entries(LC3_INSTRUCTIONS)) {
      assert.ok(info.mnemonic, `${name} missing mnemonic`);
      assert.ok(info.brief, `${name} missing brief`);
      assert.ok(info.description, `${name} missing description`);
      assert.ok(info.syntax.length > 0, `${name} missing syntax`);
      assert.ok(info.encoding, `${name} missing encoding`);
      assert.ok(info.category, `${name} missing category`);
      assert.ok(info.example, `${name} missing example`);
    }
  });

  it("mnemonic matches key", () => {
    for (const [name, info] of Object.entries(LC3_INSTRUCTIONS)) {
      assert.strictEqual(info.mnemonic, name);
    }
  });
});

describe("TRAP_ALIASES", () => {
  it("contains all 6 trap aliases", () => {
    const expected = ["GETC", "OUT", "PUTS", "IN", "PUTSP", "HALT"];
    for (const alias of expected) {
      assert.ok(alias in TRAP_ALIASES, `Missing trap alias: ${alias}`);
    }
  });

  it("every alias has category trap_alias", () => {
    for (const [name, info] of Object.entries(TRAP_ALIASES)) {
      assert.strictEqual(info.category, "trap_alias", `${name} has wrong category`);
    }
  });
});

describe("PSEUDO_OPS", () => {
  it("contains all 6 pseudo-ops", () => {
    const expected = [".ORIG", ".FILL", ".BLKW", ".STRINGZ", ".END", ".EXTERNAL"];
    for (const op of expected) {
      assert.ok(op in PSEUDO_OPS, `Missing pseudo-op: ${op}`);
    }
  });

  it("every pseudo-op has category pseudo_op", () => {
    for (const [name, info] of Object.entries(PSEUDO_OPS)) {
      assert.strictEqual(info.category, "pseudo_op", `${name} has wrong category`);
    }
  });
});

describe("BRANCH_VARIANTS", () => {
  it("contains all 7 branch variants", () => {
    const expected = ["BRN", "BRZ", "BRP", "BRNZ", "BRNP", "BRZP", "BRNZP"];
    for (const v of expected) {
      assert.ok(v in BRANCH_VARIANTS, `Missing branch variant: ${v}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
//  getAllMnemonics
// ═══════════════════════════════════════════════════════════════════

describe("getAllMnemonics", () => {
  it("returns a non-empty array", () => {
    const mnemonics = getAllMnemonics();
    assert.ok(mnemonics.length > 0);
  });

  it("includes instructions, traps, pseudo-ops, and branches", () => {
    const mnemonics = getAllMnemonics();
    assert.ok(mnemonics.includes("ADD"));
    assert.ok(mnemonics.includes("HALT"));
    assert.ok(mnemonics.includes(".ORIG"));
    assert.ok(mnemonics.includes("BRNZP"));
  });

  it("does not contain duplicates", () => {
    const mnemonics = getAllMnemonics();
    const unique = new Set(mnemonics);
    assert.strictEqual(mnemonics.length, unique.size);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  lookupMnemonic
// ═══════════════════════════════════════════════════════════════════

describe("lookupMnemonic", () => {
  it("looks up core instructions", () => {
    const info = lookupMnemonic("ADD");
    assert.ok(info);
    assert.strictEqual(info.mnemonic, "ADD");
  });

  it("is case-insensitive", () => {
    assert.ok(lookupMnemonic("add"));
    assert.ok(lookupMnemonic("Add"));
    assert.ok(lookupMnemonic("halt"));
  });

  it("looks up trap aliases", () => {
    const info = lookupMnemonic("PUTS");
    assert.ok(info);
    assert.strictEqual(info.category, "trap_alias");
  });

  it("looks up pseudo-ops", () => {
    const info = lookupMnemonic(".ORIG");
    assert.ok(info);
    assert.strictEqual(info.category, "pseudo_op");
  });

  it("looks up branch variants and returns BR info with variant brief", () => {
    const info = lookupMnemonic("BRN");
    assert.ok(info);
    assert.ok(info.brief.includes("Negative"));
  });

  it("returns undefined for unknown mnemonics", () => {
    assert.strictEqual(lookupMnemonic("MOV"), undefined);
    assert.strictEqual(lookupMnemonic("PUSH"), undefined);
    assert.strictEqual(lookupMnemonic(""), undefined);
  });

  it("condition code info is correct", () => {
    assert.strictEqual(lookupMnemonic("ADD")!.setsCC, true);
    assert.strictEqual(lookupMnemonic("AND")!.setsCC, true);
    assert.strictEqual(lookupMnemonic("NOT")!.setsCC, true);
    assert.strictEqual(lookupMnemonic("LD")!.setsCC, true);
    assert.strictEqual(lookupMnemonic("ST")!.setsCC, false);
    assert.strictEqual(lookupMnemonic("LEA")!.setsCC, false);
    assert.strictEqual(lookupMnemonic("BR")!.setsCC, false);
    assert.strictEqual(lookupMnemonic("JSR")!.setsCC, false);
  });
});
