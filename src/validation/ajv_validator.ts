import { Ajv, type ErrorObject } from "ajv";
import addFormatsImport from "ajv-formats";
import type { RuleId } from "../config/schema.js";

const addFormatsAny = addFormatsImport as unknown as
  | ((ajv: Ajv) => void)
  | { default: (ajv: Ajv) => void };
const addFormats: (ajv: Ajv) => void =
  typeof addFormatsAny === "function" ? addFormatsAny : addFormatsAny.default;

export function createAjv(): Ajv {
  const ajv = new Ajv({ strict: false, allErrors: true });
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
