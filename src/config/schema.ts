import { z } from "zod";

export const Severity = z.enum(["error", "warn", "off"]);
export type Severity = z.infer<typeof Severity>;

export const RuleId = z.enum([
  "invalid-frontmatter",
  "schema-violation",
  "required-fields",
  "type-mismatch",
  "unknown-fields",
  "duplicate-key",
  "empty-body",
  "projection-missing",
]);
export type RuleId = z.infer<typeof RuleId>;

export const Rules = z.partialRecord(RuleId, Severity);
export type Rules = z.infer<typeof Rules>;

export const Sort = z.object({
  field: z.string().min(1),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const Format = z.enum(["markdown-frontmatter", "json", "yaml"]);
export type Format = z.infer<typeof Format>;

export const TypeConfig = z.object({
  content: z.string().min(1),
  format: Format,
  schema: z.string().min(1),
  projection: z.string().min(1),
  key: z.string().min(1),
  sort: Sort.optional(),
  index: z.string().min(1).optional(),
  rules: Rules.optional(),
});
export type TypeConfig = z.infer<typeof TypeConfig>;

export const IndexConfig = z.object({
  combined: z.boolean().default(true),
  per_type: z.boolean().default(false),
  file: z.string().min(1).default("index.json"),
});
export type IndexConfig = z.infer<typeof IndexConfig>;

export const Config = z
  .object({
    name: z.string().min(1),
    output: z.string().default("."),
    index: IndexConfig.prefault({}),
    types: z.record(z.string(), TypeConfig),
    rules: Rules.prefault({}),
    llms: z.boolean().default(false),
    update_readme: z.boolean().default(false),
  })
  .refine((c) => Object.keys(c.types).length > 0, {
    message: "At least one content type must be defined",
    path: ["types"],
  });
export type Config = z.infer<typeof Config>;
