# LC-3 Assembly for ECE 306 (UT Austin)

LC-3 assembly support for VS Code, built for **ECE 306** and the Patt & Patel
*Introduction to Computing Systems* textbook. It opens `.asm`, `.lc3` and `.s`
files.

This is the UT Austin build of the extension. Install and update it from the
[course page](https://www.cs.utexas.edu/~abdonm/lc3-extension.html). It can be
installed next to the public "LC-3 Assembly" extension.

## What you get

- **Syntax highlighting** for every LC-3 opcode, TRAP alias, pseudo-op,
  register, number format, label and comment.
- **Instruction hovers:** hover an opcode to see what it does, its syntax, its
  16-bit encoding and whether it sets the condition codes.
- **Number hovers:** hover `#-5`, `x3000` or `b0101` to see the value in
  decimal, hex and binary, and whether it fits in `imm5`, `offset6`,
  `trapvect8`, `PCoffset9` or `PCoffset11`.
- **Autocomplete** for instructions, pseudo-ops, registers, your labels, and
  the device registers `KBSR`, `KBDR`, `DSR`, `DDR` and `MCR`.
- **Error checking as you type:** unknown labels, bad operands, labels you never
  use, and branches or loads whose target is too far away for the offset field.
- **LC-3 Memory Map** in the Explorer sidebar, showing the address of every
  instruction and data word. Click an entry to jump to that line.

## Commands

Open the Command Palette (<kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>)
and type **LC-3**:

| Command | Use it to |
|---|---|
| **ECE 306: New Lab File** | Start a lab with the course header (name, UT EID, lab, date, description) already filled in. |
| **Assemble Current File (lc3as)** | Assemble the open file. Save it first. |
| **Run Current File (lc3sim)** | Run the program in the simulator. It assembles first if needed. |
| **Insert UT Honor Code Block** | Add the honor-code statement to the top of the file. |

Assembling and running need [lc3tools](https://github.com/chiragsakhuja/lc3tools)
installed. If `lc3as` and `lc3sim` aren't on your `PATH`, set
**`lc3.lc3tools.binPath`** to the folder that contains them.

## Snippets

Type a prefix and press <kbd>Tab</kbd>:

| Prefix | Inserts |
|---|---|
| `ece306_lab` | Lab file header |
| `program` | `.ORIG` / `HALT` / `.END` skeleton |
| `subroutine`, `callee_save` | Subroutine with register save/restore |
| `push`, `pop` | Stack operations using R6 |
| `loop_counter`, `loop_sentinel`, `if_else` | Control flow |
| `negate`, `clear`, `multiply`, `or_demorgan`, `popcount` | Arithmetic and bit tricks |
| `print_string`, `getchar`, `read_decimal`, `print_decimal` | Console I/O with TRAPs |
| `poll_input`, `poll_output` | Keyboard and display polling with KBSR/KBDR and DSR/DDR |
| `strlen`, `array_sum`, `count_occurrences` | Common lab routines |

## Settings

| Setting | Default | What it does |
|---|---|---|
| `lc3.diagnostics.enable` | on | Error checking as you type. |
| `lc3.diagnostics.warnUnusedLabels` | on | Warn about labels that are never used. |
| `lc3.diagnostics.warnPCRelativeOverflow` | on | Warn when a label is too far away for the offset field. |
| `lc3.hover.showEncoding` | on | Show the binary encoding in instruction hovers. |
| `lc3.lc3tools.binPath` | empty | Folder containing `lc3as` and `lc3sim`. |
| `lc3.lc3tools.useGUI` | off | Run in the lc3tools GUI simulator instead of the terminal. |
| `lc3.honorCode.promptOnFirstSave` | off | Add (`always`) or offer to add (`ask`) the honor-code block the first time you save each file. |

## Updates

The extension checks the course page once a day and shows a notification when
a new version is available.

## Academic integrity

This extension helps you write and understand LC-3 code. It does not write your
labs for you. Follow the ECE 306 collaboration policy and the UT Honor Code.

---

Instructors and TAs: see `docs/UT-INTERNAL.md` in the repository for the
grader, starter-code generator and release process.
