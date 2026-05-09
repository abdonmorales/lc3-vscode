// Pure formatters used by the numeric-literal hover. No vscode dependency
// so the math and table layout are unit-testable.

/** Mask a JS number to 16 unsigned bits. */
export function toU16(value: number): number {
    return value & 0xFFFF;
}

/** Interpret a 16-bit value as signed two's complement. */
export function toS16(value: number): number {
    const u = toU16(value);
    return u & 0x8000 ? u - 0x10000 : u;
}

/** Hex with leading `x` and 4 zero-padded digits, uppercase. */
export function hex16(value: number): string {
    return "x" + toU16(value).toString(16).toUpperCase().padStart(4, "0");
}

/** 16-bit binary, grouped in nibbles for readability. */
export function bin16(value: number): string {
    const bits = toU16(value).toString(2).padStart(16, "0");
    return bits.match(/.{4}/g)!.join(" ");
}

/**
 * Whether a signed value fits in `bits` bits of two's-complement encoding.
 * Used for imm5 (5), offset6 (6), trapvect8 unsigned (8), PCoffset9 (9),
 * PCoffset11 (11). Range for a signed N-bit field is [-2^(N-1), 2^(N-1)-1].
 */
export function fitsSigned(value: number, bits: number): boolean {
    const max = (1 << (bits - 1)) - 1;
    const min = -(1 << (bits - 1));
    return value >= min && value <= max;
}

/** Range for `fitsSigned(_, bits)`, formatted as e.g. "-16…15". */
export function signedRange(bits: number): string {
    const max = (1 << (bits - 1)) - 1;
    const min = -(1 << (bits - 1));
    return `${min}…${max}`;
}

/** Whether an unsigned value fits in `bits` bits (for trapvect8). */
export function fitsUnsigned(value: number, bits: number): boolean {
    return value >= 0 && value < (1 << bits);
}

export interface NumericLiteralAnalysis {
    /** The original source token, e.g. "#-7" or "x3000". */
    token: string;
    /** The parsed value as a JS number (may be negative for #-N). */
    value: number;
    /** 16-bit unsigned interpretation. */
    unsigned: number;
    /** 16-bit signed two's-complement interpretation. */
    signed: number;
    /** Hex representation of the 16-bit value. */
    hex: string;
    /** Grouped binary representation of the 16-bit value. */
    binary: string;
    /** Encoding fields the value can fit into. */
    fits: {
        imm5: boolean;
        offset6: boolean;
        trapvect8: boolean;
        pcOffset9: boolean;
        pcOffset11: boolean;
    };
}

export function analyzeNumericLiteral(token: string, value: number): NumericLiteralAnalysis {
    return {
        token,
        value,
        unsigned: toU16(value),
        signed: toS16(value),
        hex: hex16(value),
        binary: bin16(value),
        fits: {
            imm5: fitsSigned(value, 5),
            offset6: fitsSigned(value, 6),
            trapvect8: fitsUnsigned(value, 8),
            pcOffset9: fitsSigned(value, 9),
            pcOffset11: fitsSigned(value, 11),
        },
    };
}

/**
 * Render the analysis as a markdown block. Kept pure so tests can assert
 * on the exact output without spinning up VS Code.
 */
export function renderNumericHoverMarkdown(a: NumericLiteralAnalysis): string {
    const fitMark = (ok: boolean) => (ok ? "✓" : "✗");
    return [
        `### Numeric literal: \`${a.token}\``,
        "",
        `| Form | Value |`,
        `|---|---|`,
        `| Decimal (signed 16-bit) | \`${a.signed}\` |`,
        `| Decimal (unsigned 16-bit) | \`${a.unsigned}\` |`,
        `| Hexadecimal | \`${a.hex}\` |`,
        `| Binary | \`${a.binary}\` |`,
        "",
        `**Fits in encoding field:**`,
        "",
        `| Field | Range | Used by | Fits |`,
        `|---|---|---|---|`,
        `| imm5 | ${signedRange(5)} | ADD/AND immediate | ${fitMark(a.fits.imm5)} |`,
        `| offset6 | ${signedRange(6)} | LDR/STR | ${fitMark(a.fits.offset6)} |`,
        `| trapvect8 | 0…255 | TRAP | ${fitMark(a.fits.trapvect8)} |`,
        `| PCoffset9 | ${signedRange(9)} | BR/LD/LDI/LEA/ST/STI | ${fitMark(a.fits.pcOffset9)} |`,
        `| PCoffset11 | ${signedRange(11)} | JSR | ${fitMark(a.fits.pcOffset11)} |`,
    ].join("\n");
}
