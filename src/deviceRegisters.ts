// LC-3 memory-mapped device registers (Patt & Patel §A.3 and §8.2).
// Pulled out of extension.ts so the hover/completion contributions
// share one source of truth that's also unit-testable.

export interface DeviceRegister {
    /** Symbolic name as used in `.FILL KBSR`-style declarations. */
    name: string;
    /** 16-bit memory address. */
    address: number;
    /** One-line summary for the completion-list detail field. */
    brief: string;
    /** Multiline markdown for hover. Includes bit layout. */
    description: string;
}

const hex = (n: number) => "x" + n.toString(16).toUpperCase().padStart(4, "0");

export const DEVICE_REGISTERS: DeviceRegister[] = [
    {
        name: "KBSR",
        address: 0xFE00,
        brief: "Keyboard Status Register (xFE00)",
        description: [
            "**KBSR — Keyboard Status Register** (`xFE00`)",
            "",
            "Bit 15 is set when a new character has been typed and is waiting in `KBDR`.",
            "Cleared when the program reads `KBDR`.",
            "",
            "```",
            "| 15 |          14 .. 0          |",
            "| RDY|          unused           |",
            "```",
            "",
            "Typical poll loop:",
            "```lc3",
            "POLL    LDI R0, KBSRptr",
            "        BRzp POLL          ; spin while bit 15 == 0",
            "        LDI R0, KBDRptr    ; consume the character",
            "KBSRptr .FILL xFE00",
            "KBDRptr .FILL xFE02",
            "```"
        ].join("\n"),
    },
    {
        name: "KBDR",
        address: 0xFE02,
        brief: "Keyboard Data Register (xFE02)",
        description: [
            "**KBDR — Keyboard Data Register** (`xFE02`)",
            "",
            "Bits 7:0 hold the ASCII code of the most recently typed character.",
            "Bits 15:8 are zero. Reading `KBDR` clears `KBSR[15]`.",
            "",
            "Always check `KBSR[15]` first or use the `GETC` TRAP, which does the polling for you."
        ].join("\n"),
    },
    {
        name: "DSR",
        address: 0xFE04,
        brief: "Display Status Register (xFE04)",
        description: [
            "**DSR — Display Status Register** (`xFE04`)",
            "",
            "Bit 15 is set when the display is ready to accept a new character.",
            "Cleared when the program writes to `DDR`.",
            "",
            "```",
            "| 15 |          14 .. 0          |",
            "| RDY|          unused           |",
            "```",
            "",
            "Typical poll loop:",
            "```lc3",
            "POLL    LDI R1, DSRptr",
            "        BRzp POLL          ; wait until bit 15 == 1",
            "        STI R0, DDRptr     ; send the character",
            "DSRptr  .FILL xFE04",
            "DDRptr  .FILL xFE06",
            "```"
        ].join("\n"),
    },
    {
        name: "DDR",
        address: 0xFE06,
        brief: "Display Data Register (xFE06)",
        description: [
            "**DDR — Display Data Register** (`xFE06`)",
            "",
            "Bits 7:0: ASCII character to display. Writing clears `DSR[15]`; the display sets it again when it has finished consuming the character.",
            "",
            "The `OUT` and `PUTS` TRAPs handle this polling for you — only touch `DDR` directly if you're writing your own output routine (a common ECE 306 lab)."
        ].join("\n"),
    },
    {
        name: "MCR",
        address: 0xFFFE,
        brief: "Machine Control Register (xFFFE)",
        description: [
            "**MCR — Machine Control Register** (`xFFFE`)",
            "",
            "Bit 15 (the *clock enable*) gates the LC-3's clock. **Clearing bit 15 halts the machine** — that's exactly what the `HALT` TRAP routine does internally.",
            "",
            "```",
            "| 15 |          14 .. 0          |",
            "| CE |          unused           |",
            "```",
            "",
            "You almost never write to `MCR` from user code. If a lab asks you to halt without invoking the `HALT` TRAP, the canonical sequence is:",
            "```lc3",
            "        LDI R0, MCRptr",
            "        LD  R1, MASK",
            "        AND R0, R0, R1     ; clear bit 15",
            "        STI R0, MCRptr",
            "MCRptr  .FILL xFFFE",
            "MASK    .FILL x7FFF",
            "```"
        ].join("\n"),
    },
];

/**
 * Look up a device register by name (case-insensitive). Returns null
 * if `name` isn't one of the standard memory-mapped registers.
 */
export function lookupDeviceRegister(name: string): DeviceRegister | null {
    const upper = name.toUpperCase();
    return DEVICE_REGISTERS.find((d) => d.name === upper) ?? null;
}

/** Stable hex formatter used by the hover code; exported for tests. */
export function formatAddress(address: number): string {
    return hex(address);
}
