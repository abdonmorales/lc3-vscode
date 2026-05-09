import * as assert from "assert";
import {
    toU16,
    toS16,
    hex16,
    bin16,
    fitsSigned,
    fitsUnsigned,
    signedRange,
    analyzeNumericLiteral,
    renderNumericHoverMarkdown,
} from "../numericHoverUtils";

describe("toU16 / toS16", () => {
    it("masks negative values to two's-complement 16-bit", () => {
        assert.strictEqual(toU16(-1), 0xFFFF);
        assert.strictEqual(toU16(-32768), 0x8000);
    });
    it("sign-extends 0x8000 as -32768", () => {
        assert.strictEqual(toS16(0x8000), -32768);
    });
    it("leaves positives below 0x8000 unchanged", () => {
        assert.strictEqual(toS16(0x3000), 0x3000);
        assert.strictEqual(toU16(0x3000), 0x3000);
    });
});

describe("hex16 / bin16", () => {
    it("formats with leading x and 4 zero-padded uppercase digits", () => {
        assert.strictEqual(hex16(0xFE00), "xFE00");
        assert.strictEqual(hex16(0), "x0000");
        assert.strictEqual(hex16(-1), "xFFFF");
    });
    it("groups binary into nibbles", () => {
        assert.strictEqual(bin16(0xA5), "0000 0000 1010 0101");
        assert.strictEqual(bin16(0xFFFF), "1111 1111 1111 1111");
    });
});

describe("fitsSigned / fitsUnsigned / signedRange", () => {
    it("imm5 boundaries", () => {
        assert.ok(fitsSigned(15, 5));
        assert.ok(fitsSigned(-16, 5));
        assert.ok(!fitsSigned(16, 5));
        assert.ok(!fitsSigned(-17, 5));
    });
    it("PCoffset9 boundaries", () => {
        assert.ok(fitsSigned(255, 9));
        assert.ok(fitsSigned(-256, 9));
        assert.ok(!fitsSigned(256, 9));
        assert.ok(!fitsSigned(-257, 9));
    });
    it("PCoffset11 boundaries", () => {
        assert.ok(fitsSigned(1023, 11));
        assert.ok(fitsSigned(-1024, 11));
        assert.ok(!fitsSigned(1024, 11));
    });
    it("trapvect8 is unsigned 0..255", () => {
        assert.ok(fitsUnsigned(0, 8));
        assert.ok(fitsUnsigned(255, 8));
        assert.ok(!fitsUnsigned(256, 8));
        assert.ok(!fitsUnsigned(-1, 8));
    });
    it("signedRange formats min…max", () => {
        assert.strictEqual(signedRange(5), "-16…15");
        assert.strictEqual(signedRange(9), "-256…255");
    });
});

describe("analyzeNumericLiteral", () => {
    it("computes all four interpretations", () => {
        const a = analyzeNumericLiteral("x3000", 0x3000);
        assert.strictEqual(a.signed, 0x3000);
        assert.strictEqual(a.unsigned, 0x3000);
        assert.strictEqual(a.hex, "x3000");
        assert.strictEqual(a.binary, "0011 0000 0000 0000");
    });
    it("flags imm5 fit for #7", () => {
        const a = analyzeNumericLiteral("#7", 7);
        assert.ok(a.fits.imm5);
        assert.ok(a.fits.offset6);
        assert.ok(a.fits.pcOffset9);
    });
    it("flags imm5 overflow for #16", () => {
        const a = analyzeNumericLiteral("#16", 16);
        assert.ok(!a.fits.imm5);
        assert.ok(a.fits.offset6);
    });
});

describe("renderNumericHoverMarkdown", () => {
    it("includes the token and a fit row", () => {
        const md = renderNumericHoverMarkdown(analyzeNumericLiteral("#-7", -7));
        assert.match(md, /#-7/);
        assert.match(md, /imm5/);
        assert.match(md, /PCoffset9/);
    });
});
