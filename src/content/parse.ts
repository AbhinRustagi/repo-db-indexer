import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import type { Format } from "../config/schema.js";

export type ParseFailureReason =
  | "read-error"
  | "invalid-frontmatter"
  | "invalid-json"
  | "invalid-yaml"
  | "non-object";

export type ParseResult =
  | { ok: true; data: Record<string, unknown>; body?: string }
  | { ok: false; reason: ParseFailureReason; message: string };

export async function parseItem(
  absPath: string,
  format: Format
): Promise<ParseResult> {
  let raw: string;
  try {
    raw = await readFile(absPath, "utf8");
  } catch (err) {
    return { ok: false, reason: "read-error", message: errMsg(err) };
  }

  switch (format) {
    case "markdown-frontmatter":
      return parseMarkdownFrontmatter(raw);
    case "json":
      return parseJsonContent(raw);
    case "yaml":
      return parseYamlContent(raw);
  }
}

function parseMarkdownFrontmatter(raw: string): ParseResult {
  let parsed;
  try {
    parsed = matter(raw);
  } catch (err) {
    return { ok: false, reason: "invalid-frontmatter", message: errMsg(err) };
  }
  const data = parsed.data ?? {};
  if (!isPlainObject(data)) {
    return {
      ok: false,
      reason: "invalid-frontmatter",
      message: "Frontmatter must be a YAML mapping at the root",
    };
  }
  return { ok: true, data, body: parsed.content };
}

function parseJsonContent(raw: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: "invalid-json", message: errMsg(err) };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      reason: "non-object",
      message: "JSON file must contain an object at the root",
    };
  }
  return { ok: true, data: value };
}

function parseYamlContent(raw: string): ParseResult {
  let value: unknown;
  try {
    value = parseYaml(raw);
  } catch (err) {
    return { ok: false, reason: "invalid-yaml", message: errMsg(err) };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      reason: "non-object",
      message: "YAML file must contain a mapping at the root",
    };
  }
  return { ok: true, data: value };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
