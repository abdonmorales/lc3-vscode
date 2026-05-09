import * as assert from "assert";
import { DEVICE_REGISTERS, lookupDeviceRegister, formatAddress } from "../deviceRegisters";

describe("device registers table", () => {
    it("has the five textbook MMRs at the documented addresses", () => {
        const byName = Object.fromEntries(DEVICE_REGISTERS.map((d) => [d.name, d.address]));
        assert.strictEqual(byName.KBSR, 0xFE00);
        assert.strictEqual(byName.KBDR, 0xFE02);
        assert.strictEqual(byName.DSR, 0xFE04);
        assert.strictEqual(byName.DDR, 0xFE06);
        assert.strictEqual(byName.MCR, 0xFFFE);
    });

    it("lookupDeviceRegister is case-insensitive", () => {
        assert.strictEqual(lookupDeviceRegister("kbsr")?.address, 0xFE00);
        assert.strictEqual(lookupDeviceRegister("Mcr")?.address, 0xFFFE);
    });

    it("returns null for non-MMR names", () => {
        assert.strictEqual(lookupDeviceRegister("LOOP"), null);
        assert.strictEqual(lookupDeviceRegister("R0"), null);
    });

    it("formatAddress yields uppercase 4-digit hex", () => {
        assert.strictEqual(formatAddress(0xFE00), "xFE00");
        assert.strictEqual(formatAddress(0), "x0000");
    });
});
