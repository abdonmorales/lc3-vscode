import * as vscode from "vscode";
import { analyzeNumericLiteral, renderNumericHoverMarkdown } from "./numericHoverUtils";

/**
 * Build a hover MarkdownString for a numeric literal. Wraps the pure
 * markdown renderer with VS Code's MarkdownString so the hover provider
 * can return it directly.
 */
export function formatNumericLiteralHover(token: string, value: number): vscode.MarkdownString {
    const md = new vscode.MarkdownString(renderNumericHoverMarkdown(analyzeNumericLiteral(token, value)));
    md.isTrusted = true;
    return md;
}
