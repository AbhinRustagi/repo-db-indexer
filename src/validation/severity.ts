import type {
  Config,
  RuleId,
  Severity,
  TypeConfig,
} from "../config/schema.js";

export const DEFAULT_SEVERITIES: Record<RuleId, Severity> = {
  "read-error": "error",
  "invalid-frontmatter": "error",
  "invalid-json": "error",
  "invalid-yaml": "error",
  "schema-violation": "error",
  "required-fields": "error",
  "type-mismatch": "error",
  "unknown-fields": "warn",
  "duplicate-key": "error",
  "empty-body": "off",
  "projection-missing": "warn",
};

export function severityFor(
  config: Config,
  typeConfig: TypeConfig,
  rule: RuleId
): Severity {
  return (
    typeConfig.rules?.[rule] ??
    config.rules[rule] ??
    DEFAULT_SEVERITIES[rule]
  );
}
