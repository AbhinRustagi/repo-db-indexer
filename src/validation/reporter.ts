import type { Diagnostic } from "./diagnostic.js";

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
}

export function summarize(diagnostics: Diagnostic[]): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return "";

  const byPath = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = byPath.get(d.path) ?? [];
    list.push(d);
    byPath.set(d.path, list);
  }

  const lines: string[] = [];
  for (const [path, diags] of byPath) {
    lines.push(path);
    for (const d of diags) {
      lines.push(`  ${d.severity.padEnd(7)} ${d.message}  (${d.rule})`);
    }
    lines.push("");
  }

  const { errors, warnings } = summarize(diagnostics);
  lines.push(
    `${diagnostics.length} problems (${errors} errors, ${warnings} warnings)`
  );
  return lines.join("\n");
}
