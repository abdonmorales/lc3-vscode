# LC-3 Assembly Language — VSCode Extension

Full-featured LC-3 assembly language support for Visual Studio Code, designed around the **Patt & Patel *Introduction to Computing Systems*** textbook ISA as used in **UT Austin ECE 306**.

---

## Features

### Syntax Highlighting
Rich, semantic colorization for the entire LC-3 assembly language:
- **Opcodes** — `ADD`, `AND`, `NOT`, `LD`, `LDI`, `LDR`, `LEA`, `ST`, `STI`, `STR`, `BR` variants, `JMP`, `JSR`, `JSRR`, `RET`, `RTI`, `TRAP`
- **TRAP aliases** — `HALT`, `GETC`, `OUT`, `PUTS`, `IN`, `PUTSP`
- **Pseudo-ops** — `.ORIG`, `.FILL`, `.BLKW`, `.STRINGZ`, `.END`, `.EXTERNAL`
- **Registers** — `R0`–`R7`
- **Numbers** — decimal (`#-5`), hex (`x3000`), binary (`b0101`)
- **Labels** and **comments** (`;`)

### Hover Documentation
Hover over any instruction, pseudo-op, register, or TRAP alias to see:
- Description pulled from the textbook ISA specification
- Assembly syntax format
- Binary encoding diagram (bits [15:0])
- Whether condition codes (N, Z, P) are modified
- Example usage

Register hovers include convention notes (R0 for I/O, R6 for SP, R7 for return address).

### Autocomplete
Context-aware suggestions for:
- All instructions with tab-stop snippets (e.g., typing `ADD` fills `ADD R0, R1, R2` with cursor stops)
- Pseudo-ops with appropriate operand templates
- TRAP aliases
- Registers R0–R7
- Labels defined elsewhere in your file

### Snippet Library
Common LC-3 patterns from the course, triggered by keyword:

| Prefix           | What it inserts                                       |
|------------------|-------------------------------------------------------|
| `program`        | Full program template (`.ORIG` / `HALT` / `.END`)     |
| `subroutine`     | Subroutine with R7 save/restore                       |
| `loop_counter`   | Counter-controlled loop (decrement to zero)            |
| `loop_sentinel`  | Sentinel-controlled loop (exit on zero)                |
| `negate`         | Two's complement negation (`NOT` + `ADD #1`)           |
| `clear`          | Clear register (`AND Rx, Rx, #0`)                      |
| `push`           | Push to stack (R6 convention)                          |
| `pop`            | Pop from stack                                         |
| `callee_save`    | Callee-save register pattern                           |
| `print_string`   | `LEA` + `PUTS` with `.STRINGZ`                        |
| `getchar`        | `GETC` + `OUT`                                         |
| `poll_input`     | Polling loop via KBSR/KBDR                             |
| `poll_output`    | Polling loop via DSR/DDR                               |
| `if_else`        | Conditional branch pattern                             |
| `multiply`       | Multiply by repeated addition                          |
| `or_demorgan`    | Bitwise OR via De Morgan's law                         |

### Real-Time Diagnostics
Errors and warnings as you type:
- **Missing `.ORIG` / `.END`**
- **Invalid register** (e.g., `R8`, using a label where a register is needed)
- **Immediate out of range** — imm5 (−16 to 15), offset6 (−32 to 31), trapvect8 (0–255)
- **Wrong operand count** for every instruction
- **`AND`/`ADD` with label operand** — a common student mistake (these require register or immediate, not labels)
- **Undefined labels** referenced in instructions
- **Unused labels** (hint-level, configurable)
- **Unknown opcodes**

### Navigation
- **Go to Definition** (`F12` or `Ctrl+Click`) — jump from label reference to its definition
- **Find All References** (`Shift+F12`) — find every use of a label
- **Outline / Symbol View** (`Ctrl+Shift+O`) — lists all labels, distinguishing code vs. data

### Signature Help
As you type instruction operands, see the expected syntax with the current parameter highlighted.

---

## Installation

### From Source (Development)
```bash
cd lc3-vscode
npm install
npm run compile
```
Then press `F5` in VSCode to launch the Extension Development Host.

### Manual Install (.vsix)
```bash
npm install -g @vscode/vsce
cd lc3-vscode
npm install
vsce package
code --install-extension lc3-assembly-1.0.0.vsix
```

---

## File Association

The extension automatically activates for files with extensions:
- `.asm`
- `.lc3`
- `.s`

You can also manually set the language mode to "LC-3 Assembly" via the status bar.

---

## Configuration

| Setting                       | Default | Description                             |
|-------------------------------|---------|-----------------------------------------|
| `lc3.diagnostics.enable`     | `true`  | Enable/disable real-time error checking |
| `lc3.diagnostics.warnUnusedLabels` | `true` | Warn about defined but unreferenced labels |
| `lc3.hover.showEncoding`     | `true`  | Show binary encoding in hover tooltips  |

---

## LC-3 Quick Reference

### The 15 Opcodes

| Opcode | Binary | Category       | Sets CC? |
|--------|--------|----------------|----------|
| ADD    | 0001   | Operate        | Yes      |
| AND    | 0101   | Operate        | Yes      |
| NOT    | 1001   | Operate        | Yes      |
| BR     | 0000   | Control        | No       |
| JMP    | 1100   | Control        | No       |
| JSR    | 0100   | Control        | No       |
| JSRR   | 0100   | Control        | No       |
| LD     | 0010   | Data Movement  | Yes      |
| LDI    | 1010   | Data Movement  | Yes      |
| LDR    | 0110   | Data Movement  | Yes      |
| LEA    | 1110   | Data Movement  | No       |
| ST     | 0011   | Data Movement  | No       |
| STI    | 1011   | Data Movement  | No       |
| STR    | 0111   | Data Movement  | No       |
| TRAP   | 1111   | Control        | No       |

> Opcode 1101 is reserved (unused). RET is `JMP R7`. RTI is opcode 1000.

### TRAP Service Routines

| Vector | Alias  | Description                          |
|--------|--------|--------------------------------------|
| x20    | GETC   | Read char (no echo) → R0             |
| x21    | OUT    | Write R0[7:0] to console             |
| x22    | PUTS   | Write null-terminated string at R0   |
| x23    | IN     | Prompt + read char (echo) → R0       |
| x24    | PUTSP  | Write packed string at R0            |
| x25    | HALT   | Halt the machine                     |

---

## License

MIT — built for educational use.
