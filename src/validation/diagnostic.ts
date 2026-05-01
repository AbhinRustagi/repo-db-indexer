import type { RuleId } from "../config/schema.js";

export interface Diagnostic {
  severity: "error" | "warn";
  rule: RuleId;
  type: string;
  path: string;
  message: string;
  detail?: string;
}
