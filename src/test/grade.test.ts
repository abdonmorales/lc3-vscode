import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { compareOutput, gradeOne } from "../../tools/grade";

describe("grade: compareOutput", () => {
    it("exact mode (default) ignores surrounding whitespace", () => {
        assert.strictEqual(compareOutput("  Sum: 11\n", "Sum: 11"), true);
        assert.strictEqual(compareOutput("Sum: 11 extra", "Sum: 11", "exact"), false);
    });

    it("contains mode matches substrings", () => {
        assert.strictEqual(compareOutput("prompt> Sum: 0\n", "Sum: 0", "contains"), true);
        assert.strictEqual(compareOutput("Sum: 1", "Sum: 0", "Contains"), false);
    });

    it("regex mode matches and treats invalid patterns as failure", () => {
        assert.strictEqual(compareOutput("Sum: 42", "Sum: \\d+", "regex"), true);
        assert.strictEqual(compareOutput("Sum: 42", "(", "regex"), false);
    });

    it("rejects unknown modes", () => {
        assert.throws(() => compareOutput("a", "a", "fuzzy"), /unknown match mode/);
    });
});

describe("grade: gradeOne", () => {
    // Stand in for lc3sim with Node itself: the "object file" is a script
    // that echoes everything it receives on stdin.
    let dir: string;
    let echoScript: string;

    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc3-grade-"));
        echoScript = path.join(dir, "echo.js");
        fs.writeFileSync(echoScript, "process.stdin.pipe(process.stdout);\n");
    });

    after(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const spec = () => ({
        simulator: process.execPath,
        objFile: echoScript,
        runCommand: "RUN\n",
        quitCommand: "QUIT\n",
    });

    it("feeds run command, test stdin and quit command in order", async () => {
        const r = await gradeOne(spec(), {
            name: "order",
            stdin: "5\n6\n",
            expectedStdout: "RUN\n5\n6\nQUIT",
        });
        assert.strictEqual(r.passed, true, r.actualStdout);
        assert.strictEqual(r.exitCode, 0);
        assert.strictEqual(r.name, "order");
    });

    it("reports a failure when output does not match", async () => {
        const r = await gradeOne(spec(), { name: "bad", stdin: "1\n", expectedStdout: "2", match: "contains" });
        assert.strictEqual(r.passed, false);
    });

    it("fails (rather than throwing) when the simulator cannot be spawned", async () => {
        const r = await gradeOne(
            { ...spec(), simulator: path.join(dir, "no-such-simulator") },
            { name: "missing", expectedStdout: "", match: "contains" }
        );
        assert.strictEqual(r.passed, false);
        assert.strictEqual(r.exitCode, -1);
    });
});
