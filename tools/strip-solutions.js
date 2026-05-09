#!/usr/bin/env node
/*
 * strip-solutions — turn an instructor's reference .asm into a student
 * starter file by replacing solution blocks with TODO markers.
 *
 * Why this lives in plain Node:
 *   The extension runs inside VS Code; this script gets used outside it
 *   (CI starter-code generation, ad-hoc by a TA at the terminal). No
 *   dependencies, no build step — just `node tools/strip-solutions.js`.
 *
 * Markers (matched in line comments, leading whitespace allowed):
 *   ; @SOLUTION [optional hint, used as the TODO message]
 *   ; @END_SOLUTION
 *
 * Everything between (exclusive) is replaced with:
 *   ; TODO: <hint or "implement this section">
 *
 * Usage:
 *   node tools/strip-solutions.js path/to/lab.asm                  → stdout
 *   node tools/strip-solutions.js -o lab-starter.asm path/to/lab.asm
 *   node tools/strip-solutions.js -i path/to/lab.asm                → in-place
 *   node tools/strip-solutions.js --check path/to/lab.asm           → exit 1
 *                                                                    if any
 *                                                                    SOLUTION
 *                                                                    blocks
 *                                                                    remain
 */

"use strict";

const fs = require("fs");
const path = require("path");

const SOLUTION_RE = /^\s*;\s*@SOLUTION\b\s*(.*?)\s*$/i;
const END_RE = /^\s*;\s*@END_SOLUTION\b/i;

function strip(source) {
    const out = [];
    let inBlock = false;
    let blockHint = "";
    let blocksFound = 0;

    for (const line of source.split(/\r?\n/)) {
        if (!inBlock) {
            const m = SOLUTION_RE.exec(line);
            if (m) {
                inBlock = true;
                blockHint = m[1];
                blocksFound += 1;
                // Preserve leading whitespace from the marker line so the
                // TODO sits at the same indent as the original code.
                const indent = line.match(/^(\s*)/)[1];
                out.push(`${indent}; TODO: ${blockHint || "implement this section"}`);
                continue;
            }
            out.push(line);
        } else if (END_RE.test(line)) {
            inBlock = false;
            blockHint = "";
        }
        // else: skip — we're inside a solution block
    }

    if (inBlock) {
        throw new Error(
            "strip-solutions: reached end of file inside an unterminated @SOLUTION block."
        );
    }

    return { out: out.join("\n"), blocksFound };
}

function parseArgs(argv) {
    const args = { check: false, inPlace: false, output: null, input: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--check") args.check = true;
        else if (a === "-i" || a === "--in-place") args.inPlace = true;
        else if (a === "-o" || a === "--output") args.output = argv[++i];
        else if (a === "-h" || a === "--help") {
            console.log(usage());
            process.exit(0);
        } else if (a.startsWith("-")) {
            console.error(`strip-solutions: unknown option ${a}`);
            console.error(usage());
            process.exit(2);
        } else if (!args.input) {
            args.input = a;
        } else {
            console.error("strip-solutions: too many positional arguments");
            process.exit(2);
        }
    }
    if (!args.input) {
        console.error(usage());
        process.exit(2);
    }
    return args;
}

function usage() {
    return [
        "Usage: strip-solutions [options] <file.asm>",
        "  -o, --output <path>   Write stripped output to <path> (default: stdout).",
        "  -i, --in-place        Overwrite the input file.",
        "      --check           Exit 1 if any @SOLUTION blocks were stripped.",
        "                        Useful in CI to assert starter code is clean.",
        "  -h, --help            Show this help.",
    ].join("\n");
}

function main() {
    const args = parseArgs(process.argv);
    const input = path.resolve(args.input);
    const source = fs.readFileSync(input, "utf8");
    const { out, blocksFound } = strip(source);

    if (args.check) {
        if (blocksFound > 0) {
            console.error(
                `strip-solutions: ${blocksFound} @SOLUTION block(s) found in ${args.input}.`
            );
            process.exit(1);
        }
        process.exit(0);
    }

    if (args.inPlace) {
        fs.writeFileSync(input, out, "utf8");
        console.error(`strip-solutions: rewrote ${args.input} (${blocksFound} block(s) stripped).`);
    } else if (args.output) {
        fs.writeFileSync(path.resolve(args.output), out, "utf8");
        console.error(
            `strip-solutions: wrote ${args.output} (${blocksFound} block(s) stripped).`
        );
    } else {
        process.stdout.write(out);
    }
}

if (require.main === module) main();

module.exports = { strip };
