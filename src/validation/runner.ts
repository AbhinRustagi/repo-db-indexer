import type {
  Config,
  Format,
  RuleId,
  TypeConfig,
} from "../config/schema.js";
import type {
  ContentItem,
  ContentParseError,
  DiscoverResult,
} from "../content/discover.js";
import { IMPLICIT_FIELDS } from "../emit/projection.js";
import { classifyAjvError, createAjv } from "./ajv_validator.js";
import type { Diagnostic } from "./diagnostic.js";
import { JsonResourceLoader } from "./schema_loader.js";
import { severityFor } from "./severity.js";

export async function runValidation(
  config: Config,
  discoverResult: DiscoverResult,
  cwd: string
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const loader = new JsonResourceLoader();
  const ajv = createAjv();

  for (const err of discoverResult.errors) {
    const typeConfig = config.types[err.type];
    if (!typeConfig) continue;
    const rule = parseFailureToRule(err.reason, typeConfig.format);
    pushDiagnostic(diagnostics, config, typeConfig, rule, {
      type: err.type,
      path: err.path,
      message: err.message,
    });
  }

  const projections = new Map<string, string[]>();
  for (const [typeName, typeConfig] of Object.entries(config.types)) {
    projections.set(typeName, await loadProjection(loader, typeConfig, cwd));
    const schema = await loader.load(typeConfig.schema, cwd);
    ajv.addSchema(schema as object, typeName);
  }

  for (const item of discoverResult.items) {
    const typeConfig = config.types[item.type];
    if (!typeConfig) continue;
    validateAgainstSchema(diagnostics, config, typeConfig, item, ajv);
    checkProjection(
      diagnostics,
      config,
      typeConfig,
      item,
      projections.get(item.type) ?? []
    );
    checkEmptyBody(diagnostics, config, typeConfig, item);
  }

  checkDuplicateKeys(diagnostics, config, discoverResult.items);

  return diagnostics;
}

async function loadProjection(
  loader: JsonResourceLoader,
  typeConfig: TypeConfig,
  cwd: string
): Promise<string[]> {
  const proj = await loader.load(typeConfig.projection, cwd);
  if (!Array.isArray(proj) || !proj.every((p) => typeof p === "string")) {
    throw new Error(
      `Projection at ${typeConfig.projection} must be a JSON array of field names`
    );
  }
  return proj;
}

function validateAgainstSchema(
  diagnostics: Diagnostic[],
  config: Config,
  typeConfig: TypeConfig,
  item: ContentItem,
  ajv: ReturnType<typeof createAjv>
): void {
  const validate = ajv.getSchema(item.type);
  if (!validate) return;
  if (validate(item.data)) return;
  for (const err of validate.errors ?? []) {
    const rule = classifyAjvError(err);
    pushDiagnostic(diagnostics, config, typeConfig, rule, {
      type: item.type,
      path: item.path,
      message: ajv.errorsText([err], { dataVar: "" }).trim(),
      detail: err.instancePath || undefined,
    });
  }
}

function checkProjection(
  diagnostics: Diagnostic[],
  config: Config,
  typeConfig: TypeConfig,
  item: ContentItem,
  projection: string[]
): void {
  for (const field of projection) {
    if (field in item.data) continue;
    if (IMPLICIT_FIELDS.has(field)) continue;
    pushDiagnostic(diagnostics, config, typeConfig, "projection-missing", {
      type: item.type,
      path: item.path,
      message: `Projection field "${field}" missing from item`,
    });
  }
}

function checkEmptyBody(
  diagnostics: Diagnostic[],
  config: Config,
  typeConfig: TypeConfig,
  item: ContentItem
): void {
  if (item.format !== "markdown-frontmatter") return;
  if ((item.body ?? "").trim().length > 0) return;
  pushDiagnostic(diagnostics, config, typeConfig, "empty-body", {
    type: item.type,
    path: item.path,
    message: "Item body is empty",
  });
}

function checkDuplicateKeys(
  diagnostics: Diagnostic[],
  config: Config,
  items: ContentItem[]
): void {
  const groups = new Map<string, Map<unknown, ContentItem[]>>();
  for (const item of items) {
    const typeConfig = config.types[item.type];
    if (!typeConfig) continue;
    const keyValue = item.data[typeConfig.key];
    if (keyValue === undefined) continue;
    let typeMap = groups.get(item.type);
    if (!typeMap) {
      typeMap = new Map();
      groups.set(item.type, typeMap);
    }
    const list = typeMap.get(keyValue) ?? [];
    list.push(item);
    typeMap.set(keyValue, list);
  }
  for (const [typeName, typeMap] of groups) {
    const typeConfig = config.types[typeName];
    if (!typeConfig) continue;
    for (const [keyValue, list] of typeMap) {
      if (list.length < 2) continue;
      for (const item of list) {
        pushDiagnostic(diagnostics, config, typeConfig, "duplicate-key", {
          type: typeName,
          path: item.path,
          message: `Duplicate ${typeConfig.key}: ${JSON.stringify(keyValue)} (${list.length} items share this key)`,
        });
      }
    }
  }
}

function pushDiagnostic(
  diagnostics: Diagnostic[],
  config: Config,
  typeConfig: TypeConfig,
  rule: RuleId,
  payload: Omit<Diagnostic, "severity" | "rule">
): void {
  const severity = severityFor(config, typeConfig, rule);
  if (severity === "off") return;
  diagnostics.push({ severity, rule, ...payload });
}

function parseFailureToRule(
  reason: ContentParseError["reason"],
  format: Format
): RuleId {
  switch (reason) {
    case "read-error":
      return "read-error";
    case "invalid-frontmatter":
      return "invalid-frontmatter";
    case "invalid-json":
      return "invalid-json";
    case "invalid-yaml":
      return "invalid-yaml";
    case "non-object":
      return format === "json" ? "invalid-json" : "invalid-yaml";
  }
}
