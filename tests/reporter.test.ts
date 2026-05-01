import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../src/validation/diagnostic.js";
import {
  formatDiagnostics,
  summarize,
} from "../src/validation/reporter.js";

const errorDiag: Diagnostic = {
  severity: "error",
  rule: "required-fields",
  type: "post",
  path: "posts/a.md",
  message: "must have required property 'title'",
};

const warnDiag: Diagnostic = {
  severity: "warn",
  rule: "unknown-fields",
  type: "post",
  path: "posts/a.md",
  message: "must NOT have additional properties",
};

describe("summarize", () => {
  it("counts errors and warnings", () => {
    expect(summarize([errorDiag, warnDiag, errorDiag])).toEqual({
      errors: 2,
      warnings: 1,
    });
  });

  it("returns zero counts for an empty list", () => {
    expect(summarize([])).toEqual({ errors: 0, warnings: 0 });
  });
});

describe("formatDiagnostics", () => {
  it("returns an empty string when there are no diagnostics", () => {
    expect(formatDiagnostics([])).toBe("");
  });

  it("groups diagnostics by file path and ends with a summary", () => {
    const out = formatDiagnostics([errorDiag, warnDiag]);
    expect(out).toContain("posts/a.md");
    expect(out).toContain("(required-fields)");
    expect(out).toContain("(unknown-fields)");
    expect(out).toContain("2 problems (1 errors, 1 warnings)");
  });
});
