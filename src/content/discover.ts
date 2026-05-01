import { resolve } from "node:path";
import type { Config, Format } from "../config/schema.js";
import { parseItem, type ParseFailureReason } from "./parse.js";
import { walk } from "./walk.js";

export interface ContentItem {
  type: string;
  path: string;
  format: Format;
  data: Record<string, unknown>;
  body?: string;
}

export interface ContentParseError {
  type: string;
  path: string;
  reason: ParseFailureReason;
  message: string;
}

export interface DiscoverResult {
  items: ContentItem[];
  errors: ContentParseError[];
}

export async function discover(
  config: Config,
  cwd: string
): Promise<DiscoverResult> {
  const items: ContentItem[] = [];
  const errors: ContentParseError[] = [];

  for (const [typeName, typeConfig] of Object.entries(config.types)) {
    const paths = await walk(typeConfig.content, cwd);
    for (const relPath of paths) {
      const absPath = resolve(cwd, relPath);
      const result = await parseItem(absPath, typeConfig.format);
      if (result.ok) {
        const item: ContentItem = {
          type: typeName,
          path: relPath,
          format: typeConfig.format,
          data: result.data,
        };
        if (result.body !== undefined) item.body = result.body;
        items.push(item);
      } else {
        errors.push({
          type: typeName,
          path: relPath,
          reason: result.reason,
          message: result.message,
        });
      }
    }
  }

  return { items, errors };
}
