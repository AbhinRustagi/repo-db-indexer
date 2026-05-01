import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { ZodError } from "zod";
import { Config } from "./schema.js";
import type { Config as ConfigType } from "./schema.js";

export class ConfigError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConfigError";
  }
}

export async function loadConfig(path: string): Promise<ConfigType> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new ConfigError(`Cannot read config file: ${path}`, { cause: err });
  }
  return parseConfigString(raw, path);
}

export function parseConfigString(
  raw: string,
  source = "<input>"
): ConfigType {
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new ConfigError(`Invalid YAML in ${source}`, { cause: err });
  }

  const result = Config.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(formatZodError(result.error, source));
  }
  return result.data;
}

function formatZodError(error: ZodError, path: string): string {
  const issues = error.issues
    .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return `Config validation failed in ${path}:\n${issues}`;
}
