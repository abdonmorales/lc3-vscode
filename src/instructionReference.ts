/**
 * LC-3 Instruction Reference Database
 * Based on the Patt & Patel "Introduction to Computing Systems" textbook.
 * Covers all 15 opcodes, pseudo-ops, and TRAP service routine aliases.
 */

export interface InstructionInfo {
  /** The mnemonic (e.g. "ADD", "LD") */
  mnemonic: string;
  /** Short one-line description */
  brief: string;
  /** Full description from the textbook */
  description: string;
  /** Assembly syntax format(s) */
  syntax: string[];
  /** Binary encoding diagram */
  encoding: string;
  /** Which condition codes are set (N, Z, P), if any */
  setsCC: boolean;
  /** Category for grouping */
  category: "operate" | "data_movement" | "control" | "pseudo_op" | "trap_alias";
  /** Example usage */
  example: string;
}

export const LC3_INSTRUCTIONS: Record<string, InstructionInfo> = {

  // ═══════════════════════════════════════════════════════════════════
  //  OPERATE INSTRUCTIONS
  // ═══════════════════════════════════════════════════════════════════

  ADD: {
    mnemonic: "ADD",
    brief: "Addition",
    description:
      "Adds the contents of SR1 to either SR2 (register mode) or a sign-extended 5-bit immediate value (immediate mode), and stores the result in DR. Condition codes N, Z, P are set based on the result.",
    syntax: ["ADD DR, SR1, SR2", "ADD DR, SR1, imm5"],
    encoding: "0001 | DR[11:9] | SR1[8:6] | 0 00 SR2[2:0]  (register mode)\n0001 | DR[11:9] | SR1[8:6] | 1 imm5[4:0]    (immediate mode)",
    setsCC: true,
    category: "operate",
    example: "ADD R2, R3, R4    ; R2 ← R3 + R4\nADD R1, R1, #-1   ; R1 ← R1 − 1  (decrement)",
  },

  AND: {
    mnemonic: "AND",
    brief: "Bitwise AND",
    description:
      "Performs a bitwise AND of SR1 and either SR2 (register mode) or a sign-extended 5-bit immediate (immediate mode), storing the result in DR. Condition codes are set. A common idiom is AND Rx, Rx, #0 to clear a register.",
    syntax: ["AND DR, SR1, SR2", "AND DR, SR1, imm5"],
    encoding: "0101 | DR[11:9] | SR1[8:6] | 0 00 SR2[2:0]  (register mode)\n0101 | DR[11:9] | SR1[8:6] | 1 imm5[4:0]    (immediate mode)",
    setsCC: true,
    category: "operate",
    example: "AND R2, R3, R4    ; R2 ← R3 AND R4\nAND R0, R0, #0    ; R0 ← 0  (clear register)",
  },

  NOT: {
    mnemonic: "NOT",
    brief: "Bitwise NOT (complement)",
    description:
      "Performs a bitwise complement of SR and stores the result in DR. Condition codes are set. To negate a value (two's complement), use NOT followed by ADD #1.",
    syntax: ["NOT DR, SR"],
    encoding: "1001 | DR[11:9] | SR[8:6] | 1 11111",
    setsCC: true,
    category: "operate",
    example: "NOT R4, R3    ; R4 ← NOT(R3)\n; Two's complement negation:\nNOT R1, R0\nADD R1, R1, #1  ; R1 ← −R0",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  DATA MOVEMENT INSTRUCTIONS
  // ═══════════════════════════════════════════════════════════════════

  LD: {
    mnemonic: "LD",
    brief: "Load (PC-relative)",
    description:
      "Loads the value from memory at address (PC† + SEXT(PCoffset9)) into DR. The address is computed by sign-extending bits [8:0] to 16 bits and adding to the incremented PC. Condition codes are set.\n\n† PC is the incremented PC (address of the next instruction).",
    syntax: ["LD DR, LABEL"],
    encoding: "0010 | DR[11:9] | PCoffset9[8:0]",
    setsCC: true,
    category: "data_movement",
    example: "LD R1, COUNT   ; R1 ← mem[COUNT]",
  },

  LDI: {
    mnemonic: "LDI",
    brief: "Load Indirect",
    description:
      "Loads a value from memory using indirect addressing. First, the address at (PC† + SEXT(PCoffset9)) is read to obtain a second address. Then the value at that second address is loaded into DR. Condition codes are set. Useful for accessing data far from the current PC.",
    syntax: ["LDI DR, LABEL"],
    encoding: "1010 | DR[11:9] | PCoffset9[8:0]",
    setsCC: true,
    category: "data_movement",
    example: "LDI R3, PTR    ; R3 ← mem[mem[PTR]]",
  },

  LDR: {
    mnemonic: "LDR",
    brief: "Load Base+Offset",
    description:
      "Loads the value from memory at address (BaseR + SEXT(offset6)) into DR. The 6-bit offset is sign-extended and added to the base register. Condition codes are set. Commonly used for array/struct access.",
    syntax: ["LDR DR, BaseR, offset6"],
    encoding: "0110 | DR[11:9] | BaseR[8:6] | offset6[5:0]",
    setsCC: true,
    category: "data_movement",
    example: "LDR R2, R3, #5   ; R2 ← mem[R3 + 5]",
  },

  LEA: {
    mnemonic: "LEA",
    brief: "Load Effective Address",
    description:
      "Computes the address (PC† + SEXT(PCoffset9)) and stores it in DR. Does NOT access memory — only computes the address. Condition codes are NOT set. Commonly used to load pointers to strings or data regions.",
    syntax: ["LEA DR, LABEL"],
    encoding: "1110 | DR[11:9] | PCoffset9[8:0]",
    setsCC: false,
    category: "data_movement",
    example: "LEA R0, HELLO   ; R0 ← address of HELLO\nPUTS             ; print string at R0",
  },

  ST: {
    mnemonic: "ST",
    brief: "Store (PC-relative)",
    description:
      "Stores the contents of SR into memory at address (PC† + SEXT(PCoffset9)). Condition codes are NOT modified.",
    syntax: ["ST SR, LABEL"],
    encoding: "0011 | SR[11:9] | PCoffset9[8:0]",
    setsCC: false,
    category: "data_movement",
    example: "ST R4, RESULT   ; mem[RESULT] ← R4",
  },

  STI: {
    mnemonic: "STI",
    brief: "Store Indirect",
    description:
      "Stores the contents of SR into memory using indirect addressing. The address at (PC† + SEXT(PCoffset9)) provides a pointer to the final destination. Condition codes are NOT modified.",
    syntax: ["STI SR, LABEL"],
    encoding: "1011 | SR[11:9] | PCoffset9[8:0]",
    setsCC: false,
    category: "data_movement",
    example: "STI R4, PTR_OUT   ; mem[mem[PTR_OUT]] ← R4",
  },

  STR: {
    mnemonic: "STR",
    brief: "Store Base+Offset",
    description:
      "Stores the contents of SR into memory at address (BaseR + SEXT(offset6)). Condition codes are NOT modified.",
    syntax: ["STR SR, BaseR, offset6"],
    encoding: "0111 | SR[11:9] | BaseR[8:6] | offset6[5:0]",
    setsCC: false,
    category: "data_movement",
    example: "STR R4, R2, #5   ; mem[R2 + 5] ← R4",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  CONTROL INSTRUCTIONS
  // ═══════════════════════════════════════════════════════════════════

  BR: {
    mnemonic: "BR",
    brief: "Conditional Branch",
    description:
      "Branches to (PC† + SEXT(PCoffset9)) if any of the specified condition codes match. The condition bits n, z, p select negative, zero, and positive respectively. Common variants:\n\n• BRn   — branch if negative\n• BRz   — branch if zero\n• BRp   — branch if positive\n• BRnz  — branch if negative or zero\n• BRnp  — branch if not zero\n• BRzp  — branch if zero or positive\n• BRnzp — unconditional branch\n• BR    — same as BRnzp (unconditional)",
    syntax: ["BR[n][z][p] LABEL"],
    encoding: "0000 | n[11] z[10] p[9] | PCoffset9[8:0]",
    setsCC: false,
    category: "control",
    example: "ADD R1, R1, #-1\nBRp LOOP          ; branch if result > 0\nBRnzp ALWAYS      ; unconditional branch",
  },

  JMP: {
    mnemonic: "JMP",
    brief: "Jump (unconditional)",
    description:
      "Unconditionally jumps to the address contained in BaseR by loading it into the PC. Condition codes are NOT modified.",
    syntax: ["JMP BaseR"],
    encoding: "1100 | 000 | BaseR[8:6] | 000000",
    setsCC: false,
    category: "control",
    example: "JMP R3   ; PC ← R3",
  },

  JSR: {
    mnemonic: "JSR",
    brief: "Jump to Subroutine (PC-relative)",
    description:
      "Saves the current PC† in R7 (return address), then jumps to (PC† + SEXT(PCoffset11)). Used to call subroutines. The return address in R7 is used by RET to return to the caller.",
    syntax: ["JSR LABEL"],
    encoding: "0100 | 1 | PCoffset11[10:0]",
    setsCC: false,
    category: "control",
    example: "JSR MULTIPLY   ; R7 ← PC, then PC ← MULTIPLY",
  },

  JSRR: {
    mnemonic: "JSRR",
    brief: "Jump to Subroutine (register)",
    description:
      "Saves the current PC† in R7, then jumps to the address contained in BaseR. This is the register-indirect variant of JSR.",
    syntax: ["JSRR BaseR"],
    encoding: "0100 | 0 | 00 | BaseR[8:6] | 000000",
    setsCC: false,
    category: "control",
    example: "JSRR R3   ; R7 ← PC, then PC ← R3",
  },

  RET: {
    mnemonic: "RET",
    brief: "Return from Subroutine",
    description:
      "Returns from a subroutine by jumping to the address in R7 (equivalent to JMP R7). R7 was set by the preceding JSR/JSRR instruction.",
    syntax: ["RET"],
    encoding: "1100 | 000 | 111 | 000000",
    setsCC: false,
    category: "control",
    example: "RET   ; PC ← R7",
  },

  RTI: {
    mnemonic: "RTI",
    brief: "Return from Interrupt",
    description:
      "Returns from a trap service routine or interrupt. Pops the PC and PSR from the supervisor stack. May only be executed in supervisor mode (PSR[15] = 0).",
    syntax: ["RTI"],
    encoding: "1000 | 000000000000",
    setsCC: false,
    category: "control",
    example: "RTI   ; return from interrupt/trap handler",
  },

  TRAP: {
    mnemonic: "TRAP",
    brief: "System Call",
    description:
      "Invokes a system call. The PC is loaded with the starting address stored in memory at ZEXT(trapvect8). R7 is saved with the return address. Standard trap vectors:\n\n• x20 GETC  — read char (no echo) into R0\n• x21 OUT   — write R0[7:0] to console\n• x22 PUTS  — write string at address in R0\n• x23 IN    — prompt + read char (with echo) into R0\n• x24 PUTSP — write packed string at R0\n• x25 HALT  — halt the program",
    syntax: ["TRAP trapvect8"],
    encoding: "1111 | 0000 | trapvect8[7:0]",
    setsCC: false,
    category: "control",
    example: "TRAP x25   ; halt execution (same as HALT)\nTRAP x23   ; prompt and read char (same as IN)",
  },
};

// ═══════════════════════════════════════════════════════════════════
//  BRANCH VARIANTS (aliases that map to BR)
// ═══════════════════════════════════════════════════════════════════

export const BRANCH_VARIANTS: Record<string, string> = {
  BRN: "Branch if Negative (N=1)",
  BRZ: "Branch if Zero (Z=1)",
  BRP: "Branch if Positive (P=1)",
  BRNZ: "Branch if Negative or Zero (N=1 or Z=1)",
  BRNP: "Branch if Negative or Positive — i.e. not zero (N=1 or P=1)",
  BRZP: "Branch if Zero or Positive (Z=1 or P=1)",
  BRNZP: "Unconditional Branch (always taken)",
};

// ═══════════════════════════════════════════════════════════════════
//  TRAP ALIASES
// ═══════════════════════════════════════════════════════════════════

export const TRAP_ALIASES: Record<string, InstructionInfo> = {
  GETC: {
    mnemonic: "GETC",
    brief: "Read Character (TRAP x20)",
    description:
      "Reads a single character from the keyboard without echoing it. The ASCII code is placed in R0[7:0], and the high 8 bits of R0 are cleared. Equivalent to TRAP x20.",
    syntax: ["GETC"],
    encoding: "1111 0000 00100000  (TRAP x20)",
    setsCC: false,
    category: "trap_alias",
    example: "GETC   ; R0 ← keyboard char (no echo)",
  },
  OUT: {
    mnemonic: "OUT",
    brief: "Write Character (TRAP x21)",
    description:
      "Writes the character in R0[7:0] to the console display. Equivalent to TRAP x21.",
    syntax: ["OUT"],
    encoding: "1111 0000 00100001  (TRAP x21)",
    setsCC: false,
    category: "trap_alias",
    example: "OUT   ; display character in R0",
  },
  PUTS: {
    mnemonic: "PUTS",
    brief: "Write String (TRAP x22)",
    description:
      "Writes a null-terminated string to the console. R0 must contain the starting address of the string. Characters are stored one per memory location. Writing terminates when x0000 is encountered. Equivalent to TRAP x22.",
    syntax: ["PUTS"],
    encoding: "1111 0000 00100010  (TRAP x22)",
    setsCC: false,
    category: "trap_alias",
    example: "LEA R0, MSG\nPUTS          ; print string starting at MSG\n;\nMSG .STRINGZ \"Hello!\"",
  },
  IN: {
    mnemonic: "IN",
    brief: "Prompt + Read Character (TRAP x23)",
    description:
      "Prints a prompt to the screen, reads a single character from the keyboard, and echoes it. The ASCII code is placed in R0[7:0], and the high 8 bits of R0 are cleared. Equivalent to TRAP x23.",
    syntax: ["IN"],
    encoding: "1111 0000 00100011  (TRAP x23)",
    setsCC: false,
    category: "trap_alias",
    example: "IN   ; print prompt, read char into R0, echo it",
  },
  PUTSP: {
    mnemonic: "PUTSP",
    brief: "Write Packed String (TRAP x24)",
    description:
      "Writes a string of ASCII characters to the console, with two characters packed per memory location. R0 holds the starting address. The low byte [7:0] is printed first, then the high byte [15:8]. Equivalent to TRAP x24.",
    syntax: ["PUTSP"],
    encoding: "1111 0000 00100100  (TRAP x24)",
    setsCC: false,
    category: "trap_alias",
    example: "PUTSP   ; print packed string starting at address in R0",
  },
  HALT: {
    mnemonic: "HALT",
    brief: "Halt Execution (TRAP x25)",
    description:
      "Halts execution of the program. Equivalent to TRAP x25. The HALT trap service routine prints a message and stops the machine clock.",
    syntax: ["HALT"],
    encoding: "1111 0000 00100101  (TRAP x25)",
    setsCC: false,
    category: "trap_alias",
    example: "HALT   ; stop program execution",
  },
};

// ═══════════════════════════════════════════════════════════════════
//  PSEUDO-OPS (Assembler Directives)
// ═══════════════════════════════════════════════════════════════════

export const PSEUDO_OPS: Record<string, InstructionInfo> = {
  ".ORIG": {
    mnemonic: ".ORIG",
    brief: "Set starting address",
    description:
      "Tells the assembler where in memory to place the program. The operand is a 16-bit address (typically in hex). For user programs, .ORIG x3000 is conventional. Must be the first non-comment line.",
    syntax: [".ORIG address"],
    encoding: "(assembler directive — not an instruction)",
    setsCC: false,
    category: "pseudo_op",
    example: ".ORIG x3000   ; place program starting at x3000",
  },
  ".FILL": {
    mnemonic: ".FILL",
    brief: "Initialize memory location",
    description:
      "Allocates one word of memory and initializes it to the given value. The value can be a decimal number, hex value (prefixed with x), or a label.",
    syntax: [".FILL value"],
    encoding: "(assembler directive — not an instruction)",
    setsCC: false,
    category: "pseudo_op",
    example: "SIX   .FILL x0006    ; store the value 6\nNEG_A .FILL #-65     ; store -65\nPTR   .FILL LABEL    ; store the address of LABEL",
  },
  ".BLKW": {
    mnemonic: ".BLKW",
    brief: "Block of words (reserve memory)",
    description:
      "Reserves a block of n consecutive memory locations. The contents are uninitialized (typically zero in simulators). Commonly used to reserve space for variables or arrays.",
    syntax: [".BLKW n"],
    encoding: "(assembler directive — not an instruction)",
    setsCC: false,
    category: "pseudo_op",
    example: "ARRAY .BLKW 10   ; reserve 10 words\nTEMP  .BLKW 1    ; reserve 1 word for a variable",
  },
  ".STRINGZ": {
    mnemonic: ".STRINGZ",
    brief: "Null-terminated string",
    description:
      "Allocates n+1 memory locations for an n-character string, with x0000 automatically appended as a null terminator. Each character occupies one word. Strings are enclosed in double quotes.",
    syntax: ['.STRINGZ "string"'],
    encoding: "(assembler directive — not an instruction)",
    setsCC: false,
    category: "pseudo_op",
    example: 'MSG .STRINGZ "Hello, world!"   ; 14 words (13 chars + null)',
  },
  ".END": {
    mnemonic: ".END",
    brief: "End of program",
    description:
      "Marks the end of the assembly language program. The assembler stops processing at this point. Must be the last pseudo-op. Does not produce any machine code.",
    syntax: [".END"],
    encoding: "(assembler directive — not an instruction)",
    setsCC: false,
    category: "pseudo_op",
    example: ".END   ; end of program source",
  },
  ".EXTERNAL": {
    mnemonic: ".EXTERNAL",
    brief: "External symbol declaration",
    description:
      "Declares a label as external — defined in another module. Used with the linker to resolve cross-module references.",
    syntax: [".EXTERNAL LABEL"],
    encoding: "(assembler directive — not an instruction)",
    setsCC: false,
    category: "pseudo_op",
    example: ".EXTERNAL MULTIPLY   ; MULTIPLY is defined elsewhere",
  },
};

/** All known mnemonics for quick lookup */
export function getAllMnemonics(): string[] {
  return [
    ...Object.keys(LC3_INSTRUCTIONS),
    ...Object.keys(TRAP_ALIASES),
    ...Object.keys(PSEUDO_OPS),
    ...Object.keys(BRANCH_VARIANTS),
  ];
}

/** Look up any mnemonic (instruction, trap alias, pseudo-op, or branch variant) */
export function lookupMnemonic(name: string): InstructionInfo | undefined {
  const upper = name.toUpperCase();
  if (upper in LC3_INSTRUCTIONS) return LC3_INSTRUCTIONS[upper];
  if (upper in TRAP_ALIASES) return TRAP_ALIASES[upper];
  if (upper in PSEUDO_OPS) return PSEUDO_OPS[upper];
  // Branch variants map to BR
  if (upper.startsWith("BR") && upper in BRANCH_VARIANTS) {
    const br = { ...LC3_INSTRUCTIONS["BR"] };
    br.brief = BRANCH_VARIANTS[upper];
    return br;
  }
  return undefined;
}
