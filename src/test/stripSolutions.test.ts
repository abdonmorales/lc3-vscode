import * as assert from "assert";
import { strip } from "../../tools/strip-solutions";

describe("strip-solutions", () => {
    it("replaces a solution block with a TODO carrying the hint", () => {
        const src = [
            "        .ORIG x3000",
            "        ; @SOLUTION add R1 and R2 into R0",
            "        ADD R0, R1, R2",
            "        ; @END_SOLUTION",
            "        HALT",
        ].join("\n");
        const { out, blocksFound } = strip(src);
        assert.strictEqual(blocksFound, 1);
        assert.strictEqual(
            out,
            ["        .ORIG x3000", "        ; TODO: add R1 and R2 into R0", "        HALT"].join("\n")
        );
    });

    it("uses a default TODO message when no hint is given", () => {
        const { out } = strip(";@SOLUTION\nADD R0, R0, #1\n;@END_SOLUTION");
        assert.strictEqual(out, "; TODO: implement this section");
    });

    it("handles multiple blocks, case-insensitive markers and CRLF input", () => {
        const src = "A\r\n; @solution one\r\nX\r\n; @end_solution\r\nB\r\n; @SOLUTION two\r\nY\r\n; @END_SOLUTION\r\nC";
        const { out, blocksFound } = strip(src);
        assert.strictEqual(blocksFound, 2);
        assert.strictEqual(out, "A\n; TODO: one\nB\n; TODO: two\nC");
    });

    it("leaves files without markers untouched", () => {
        const src = "        .ORIG x3000\n        HALT\n        .END";
        const { out, blocksFound } = strip(src);
        assert.strictEqual(blocksFound, 0);
        assert.strictEqual(out, src);
    });

    it("throws on an unterminated block", () => {
        assert.throws(() => strip("; @SOLUTION\nADD R0, R0, #1"), /unterminated/);
    });
});
