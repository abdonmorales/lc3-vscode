// Types for tools/grade.js (consumed by the unit tests).
export interface GradeSpec {
    simulator?: string;
    objFile: string;
    runCommand?: string;
    quitCommand?: string;
    cwd?: string;
    timeoutMs?: number;
    match?: string;
}

export interface GradeTest {
    name: string;
    stdin?: string;
    expectedStdout?: string;
    match?: string;
    timeoutMs?: number;
}

export interface GradeResult {
    name: string;
    passed: boolean;
    exitCode: number | null;
    actualStdout: string;
    stderr: string;
}

export function compareOutput(actual: string, expected: string, mode?: string): boolean;
export function gradeOne(spec: GradeSpec, test: GradeTest): Promise<GradeResult>;
