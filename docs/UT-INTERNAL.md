# LC-3 Assembly — UT Austin / ECE 306 internal build

This is the `ut-internal` branch of the LC-3 VS Code extension. It packages as
`lc3-assembly-ut` so it can be installed alongside the public
`lc3-assembly` extension, and it is distributed through
<https://www.cs.utexas.edu/~abdonm/lc3-extension.html> rather than a
marketplace.

Everything the public extension does (syntax highlighting, instruction hovers,
autocomplete, diagnostics, snippets) is included. This document covers what the
internal build adds.

---

## Student features

### Commands

All commands are in the Command Palette under the **LC-3** category.

| Command | ID | What it does |
|---|---|---|
| ECE 306: New Lab File | `lc3.newLabFile` | Opens an untitled `.asm` with the course header (name, UT EID, lab/assignment, date, description) and an `.ORIG x3000` skeleton. Tab moves between fields. |
| Assemble Current File (lc3as) | `lc3.assembleCurrent` | Runs `lc3as` on the active file (save first — it assembles what is on disk). |
| Run Current File (lc3sim) | `lc3.runCurrent` | Runs the `.obj` in `lc3sim` (or `lc3sim-gui` when `lc3.lc3tools.useGUI` is on), assembling first if the `.obj` is missing or older than the source. |
| Insert UT Honor Code Block | `lc3.toggleHonorCode` | Inserts the text of `lc3.honorCode.text` at the top of the file. |

The assemble/run actions are also available as tasks for `tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    { "type": "lc3", "task": "assemble", "label": "LC-3: assemble" },
    { "type": "lc3", "task": "run", "label": "LC-3: run", "file": "${workspaceFolder}/lab1.asm" }
  ]
}
```

`file` is optional and defaults to the active editor.

### Editor help

- **Number-literal hover:** hover any `#-5`, `x3000` or `b0101` immediate to see
  its signed, unsigned, hex and grouped-binary values, plus whether it fits in
  `imm5`, `offset6`, `trapvect8`, `PCoffset9` and `PCoffset11`.
- **Device registers:** `KBSR` (xFE00), `KBDR` (xFE02), `DSR` (xFE04),
  `DDR` (xFE06) and `MCR` (xFFFE) autocomplete with their addresses. Hovering
  one shows its bit layout and a ready-to-paste polling loop.
- **PC-relative range warning:** `BR`, `LD`, `LDI`, `LEA`, `ST`, `STI` and `JSR`
  get a warning when the label is too far away for the offset field. The
  message gives the computed offset and the allowed range.
- **LC-3 Memory Map:** an Explorer view, shown while an LC-3 file is open, that
  lists the address of every instruction (Program) and data word (Data), with
  its label, plus any device registers the file references. Click an entry to
  jump to its line. It updates as you type.

### Snippets added by this build

| Prefix | Inserts |
|---|---|
| `ece306_lab` | Course file header (same as the New Lab File command) |
| `count_occurrences` | Count a value in a sentinel-terminated array (textbook §6.5) |
| `strlen` | Length of a `.STRINGZ` string |
| `array_sum` | Sum the first N array elements |
| `popcount` | Count set bits in a register |
| `read_decimal` | Read a positive decimal number from the keyboard |
| `print_decimal` | Print an unsigned number in decimal |

### Settings

| Setting | Default | Purpose |
|---|---|---|
| `lc3.diagnostics.warnPCRelativeOverflow` | `true` | PC-relative range warning (above). |
| `lc3.lc3tools.binPath` | `""` | Folder containing `lc3as`/`lc3sim`. Empty means use `PATH`. |
| `lc3.lc3tools.useGUI` | `false` | Run in `lc3sim-gui` instead of the terminal simulator. |
| `lc3.honorCode.text` | UT honor-code statement | Text inserted by the honor-code command. |
| `lc3.honorCode.promptOnFirstSave` | `"off"` | `"ask"` prompts to insert the block the first time each LC-3 file is saved; `"always"` inserts it without asking. Files that already contain the block are skipped. |

### Updates

Once a day the extension fetches
`https://www.cs.utexas.edu/~abdonm/lc3-extension.json`:

```json
{ "version": "1.0.3", "url": "https://www.cs.utexas.edu/~abdonm/lc3-extension.html" }
```

If `version` is newer than the installed one, a notification offers to open
the course download page. Network or parse failures are ignored silently. To
announce a release, upload the new `.vsix` and bump `version` in that file.

---

## Instructor tools

These are plain Node scripts in `tools/` (Node 18+, no dependencies). They are
**not** included in the student `.vsix`, so run them from a checkout of this
branch.

### `tools/strip-solutions.js`: reference solution → starter code

Mark solution code in the reference `.asm`:

```asm
        .ORIG x3000
        ; @SOLUTION add R1 and R2 into R0
        ADD R0, R1, R2
        ; @END_SOLUTION
        HALT
        .END
```

Each block, markers included, becomes a single `; TODO: <hint>` line at the
same indentation. A marker without a hint produces
`; TODO: implement this section`. Markers are case-insensitive. An unterminated
block is an error.

```sh
node tools/strip-solutions.js lab1-ref.asm                 # print to stdout
node tools/strip-solutions.js -o lab1.asm lab1-ref.asm     # write a file
node tools/strip-solutions.js -i lab1.asm                  # rewrite in place
node tools/strip-solutions.js --check lab1.asm             # exit 1 if any @SOLUTION remains
```

`--check` is meant for CI, to confirm that published starter code has no
solutions left in it.

### `tools/grade.js`: lc3tools autograder

The grader assembles the submission with `lc3as` and runs each test through
`lc3sim`. For each test it sends the simulator's run command, then the test's
input, then the quit command on stdin, and compares the captured stdout
against the expected output.

```json
{
  "asmFile": "lab1.asm",
  "tests": [
    { "name": "5 + 6", "stdin": "5\n6\n", "expectedStdout": "Sum: 11", "match": "contains" },
    { "name": "any sum", "stdin": "0\n0\n", "expectedStdout": "Sum: -?\\d+", "match": "regex" }
  ]
}
```

| Spec field | Default | Meaning |
|---|---|---|
| `asmFile` | — | Source to assemble. Required unless `objFile` is set. |
| `objFile` | — | Pre-built object file. Skips assembly. |
| `assembler` / `simulator` | `lc3as` / `lc3sim` | Executables to run. |
| `runCommand` / `quitCommand` | `"c\n"` / `"q\n"` | Simulator commands sent around each test's input. |
| `timeoutMs` | `10000` | Per-test timeout. A test can override it. |
| `match` | `"exact"` | `exact` (trimmed equality), `contains` or `regex`. A test can override it. |
| `cwd` | object file's folder | Working directory for the simulator. |

```sh
node tools/grade.js tests.json                          # JSON report to stdout
node tools/grade.js --asm student.asm -o out.json tests.json
```

The exit code is 0 only when every test passes. The report looks like
`{ ok, objFile, passed, total, results: [{ name, passed, exitCode, actualStdout, stderr }] }`.
If assembly fails, the report is `{ ok: false, error, results: [] }`.

---

## Building and releasing

- `npm ci && npm run compile && npm test` builds and runs the unit tests.
  The tools are tested there too.
- Every push to `ut-internal` runs `.github/workflows/internal-build.yml`,
  which uploads `lc3-assembly-ut.vsix` and its SHA-256 as a workflow artifact.
  It publishes nothing. Download the artifact, put it on the course page, and
  bump the version manifest (see [Updates](#updates)).
- Students install it with **Extensions → … → Install from VSIX…** or
  `code --install-extension lc3-assembly-ut.vsix`.
