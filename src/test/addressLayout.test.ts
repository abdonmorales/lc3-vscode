import * as assert from "assert";
import { layoutProgram, pcRelativeOffset } from "../addressLayout";
import { parseAllLines } from "../parser";

function layout(src: string) {
    return layoutProgram(parseAllLines(src.split("\n")));
}

describe("layoutProgram", () => {
    it("uses .ORIG as the starting address", () => {
        const r = layout(`
.ORIG x4000
ADD R0, R0, #0
.END
`.trim());
        assert.strictEqual(r.origin, 0x4000);
        assert.strictEqual(r.instructions[0].address, 0x4000);
    });

    it("defaults to x3000 when .ORIG is missing", () => {
        const r = layout("ADD R0, R0, #0");
        assert.strictEqual(r.origin, 0x3000);
    });

    it("advances by 1 per instruction", () => {
        const r = layout(`
.ORIG x3000
ADD R0, R0, #0
ADD R1, R1, #1
ADD R2, R2, #2
.END
`.trim());
        assert.deepStrictEqual(
            r.instructions.map((i) => i.address),
            [0x3000, 0x3001, 0x3002]
        );
    });

    it("expands .BLKW into N words", () => {
        const r = layout(`
.ORIG x3000
DATA .BLKW 5
NEXT ADD R0, R0, #0
.END
`.trim());
        assert.strictEqual(r.labels.get("DATA"), 0x3000);
        assert.strictEqual(r.labels.get("NEXT"), 0x3005);
    });

    it("counts .STRINGZ characters plus a null terminator", () => {
        const r = layout(`
.ORIG x3000
GREET .STRINGZ "Hi"
NEXT ADD R0, R0, #0
.END
`.trim());
        // "Hi" + null = 3 words
        assert.strictEqual(r.labels.get("NEXT"), 0x3003);
    });

    it("stops counting at .END", () => {
        const r = layout(`
.ORIG x3000
A ADD R0, R0, #0
.END
B ADD R1, R1, #0
`.trim());
        assert.strictEqual(r.labels.has("B"), false);
    });

    it("records labels at the address of the next instruction", () => {
        const r = layout(`
.ORIG x3000
LOOP ADD R0, R0, #-1
     BRp LOOP
.END
`.trim());
        assert.strictEqual(r.labels.get("LOOP"), 0x3000);
    });
});

describe("pcRelativeOffset", () => {
    it("computes target - (instr + 1)", () => {
        assert.strictEqual(pcRelativeOffset(0x3000, 0x3010), 15);
        assert.strictEqual(pcRelativeOffset(0x3010, 0x3000), -17);
    });
});
