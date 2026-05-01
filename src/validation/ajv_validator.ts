import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json" with { type: "json" };
import addFormatsImport from "ajv-formats";
import type { RuleId } from "../config/schema.js";

const addFormatsAny = addFormatsImport as unknown as
  | ((ajv: Ajv2020) => void)
  | { default: (ajv: Ajv2020) => void };
const addFormats: (ajv: Ajv2020) => void =
  typeof addFormatsAny === "function" ? addFormatsAny : addFormatsAny.default;

export function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  ajv.addMetaSchema(draft7MetaSchema);
  addFormats(ajv);
  return ajv;
}

export function classifyAjvError(err: ErrorObject): RuleId {
  switch (err.keyword) {
    case "required":
      return "required-fields";
    case "type":
      return "type-mismatch";
    case "additionalProperties":
      return "unknown-fields";
    default:
      return "schema-violation";
  }
}
