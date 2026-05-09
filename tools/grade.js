#!/usr/bin/env node
/*
 * grade — minimal lc3tools grader for ECE 306 labs.
 *
 * Given a JSON test spec, assembles each .asm with `lc3as`, runs the
 * resulting .obj in `lc3sim`, feeds the test's stdin, captures stdout,
 * and compares against the expected output. Outputs a structured
 * pass/fail report to stdout (JSON) so it composes with other CI tools.
 *
 * Test spec example (tests.json):
 *
 *   {
 *     "asmFile": "lab1.asm",
 *     "simulator": "lc3sim",
 *     "runCommand": "c\n",
 *     "quitCommand": "q\n",
 *     "tests": [
 *       {
 *         "name": "5 + 6 = 11",
 *         "stdin": "5\n6\n",
 *         "expectedStdout": "Sum: 11"
 *       },
 *       {
 *         "name": "0 + 0 = 0",
 *         "stdin": "0\n0\n",
 *         "expectedStdout": "Sum: 0",
 *         "match": "contains"
 *       }
 *     ]
 *   }
 *
 * `match` controls how expectedStdout is compared:
 *   - "exact"     — full string equality after trim (default)
 *   - "contains"  — expectedStdout appears anywhere in captured output
 *   - "regex"     — expectedStdout is a regex source, must match
 *
 * Why a separate tool: the extension runs inside VS Code where shelling
 * out is awkward in CI. This script has zero deps and runs from any
 * Node 18+ install — drop it into a TA's grading repo and go.
 *
 * Usage:
 *   node tools/grade.js tests.json                # report to stdout
 *   node tools/grade.js --output results.json tests.json
 *   node tools/grade.js --asm lab1.asm tests.json # override asmFile
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function compareOutput(actual, expected, mode) {
    const m = (mode || "exact").toLowerCase();
    if (m === "exact") return actual.trim() === expected.trim();
    if (m === "contains") return actual.includes(expected);
    if (m === "regex") {
        try {
            return new RegExp(expected).test(actual);
        } catch {
            return false;
        }
    }
    throw new Error(`unknown match mode: ${mode}`);
}

function runProcess(cmd, args, stdinData, opts = {}) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, {
            cwd: opts.cwd,
            env: { ...process.env, ...opts.env },
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill("SIGKILL");
        }, opts.timeoutMs || 10_000);

        child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
        child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
        child.on("error", (err) => {
            clearTimeout(timeout);
            resolve({ code: -1, stdout, stderr: stderr + "\n" + err.message });
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            resolve({ code, stdout, stderr });
        });

        if (stdinData) child.stdin.write(stdinData);
        child.stdin.end();
    });
}

async function gradeOne(spec, test) {
    const sim = spec.simulator || "lc3sim";
    const objPath = path.resolve(spec.objFile);
    const runCmd = spec.runCommand ?? "c\n";
    const quitCmd = spec.quitCommand ?? "q\n";

    // Order on stdin: first the simulator's "run" command, then the
    // program's user input, then the simulator's "quit" command. This
    // matches the typical chiragsakhuja/lc3tools lc3sim REPL flow.
    const stdin = runCmd + (test.stdin ?? "") + quitCmd;

    const { code, stdout, stderr } = await runProcess(sim, [objPath], stdin, {
        timeoutMs: test.timeoutMs ?? spec.timeoutMs ?? 10_000,
        cwd: spec.cwd ?? path.dirname(objPath),
    });

    const passed = code !== -1 && compareOutput(stdout, test.expectedStdout ?? "", test.match ?? spec.match);

    return {
        name: test.name,
        passed,
        exitCode: code,
        actualStdout: stdout,
        stderr,
    };
}

async function assembleIfNeeded(spec) {
    if (spec.objFile) return; // pre-supplied
    if (!spec.asmFile) {
        throw new Error("grade: spec needs an `asmFile` or pre-built `objFile`.");
    }
    const asm = path.resolve(spec.asmFile);
    const stem = asm.replace(/\.(asm|lc3|s)$/i, "");
    const obj = stem + ".obj";
    const assembler = spec.assembler || "lc3as";
    const { code, stderr } = await runProcess(assembler, [asm], "", {
        timeoutMs: 10_000,
        cwd: path.dirname(asm),
    });
    if (code !== 0) {
        throw new Error(`grade: ${assembler} failed (exit ${code}):\n${stderr}`);
    }
    spec.objFile = obj;
}

function parseArgs(argv) {
    const args = { spec: null, output: null, asmOverride: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-o" || a === "--output") args.output = argv[++i];
        else if (a === "--asm") args.asmOverride = argv[++i];
        else if (a === "-h" || a === "--help") {
            console.log(usage());
            process.exit(0);
        } else if (a.startsWith("-")) {
            console.error(`grade: unknown option ${a}`);
            process.exit(2);
        } else if (!args.spec) {
            args.spec = a;
        }
    }
    if (!args.spec) {
        console.error(usage());
        process.exit(2);
    }
    return args;
}

function usage() {
    return [
        "Usage: grade [options] <tests.json>",
        "  -o, --output <path>   Write JSON results to <path> (default: stdout).",
        "      --asm <file>      Override the spec's asmFile.",
        "  -h, --help            Show this help.",
    ].join("\n");
}

async function main() {
    const args = parseArgs(process.argv);
    const spec = JSON.parse(fs.readFileSync(args.spec, "utf8"));
    if (args.asmOverride) spec.asmFile = args.asmOverride;

    try {
        await assembleIfNeeded(spec);
    } catch (e) {
        const report = { ok: false, error: e.message, results: [] };
        emit(report, args.output);
        process.exit(1);
    }

    const results = [];
    for (const test of spec.tests || []) {
        results.push(await gradeOne(spec, test));
    }

    const passed = results.filter((r) => r.passed).length;
    const report = {
        ok: passed === results.length,
        objFile: spec.objFile,
        passed,
        total: results.length,
        results,
    };
    emit(report, args.output);
    process.exit(report.ok ? 0 : 1);
}

function emit(report, outPath) {
    const json = JSON.stringify(report, null, 2);
    if (outPath) {
        fs.writeFileSync(path.resolve(outPath), json + "\n", "utf8");
    } else {
        process.stdout.write(json + "\n");
    }
}

if (require.main === module) {
    main().catch((e) => {
        console.error("grade: fatal:", e.message);
        process.exit(1);
    });
}

module.exports = { gradeOne, compareOutput };
