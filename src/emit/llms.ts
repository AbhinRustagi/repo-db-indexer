import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Config } from "../config/schema.js";
import type { ContentItem } from "../content/discover.js";

export async function emitLlmsTxt(
  config: Config,
  items: ContentItem[],
  cwd: string
): Promise<string | null> {
  if (!config.llms) return null;

  const lines: string[] = [`# ${config.name}`, ""];
  for (const [typeName, typeConfig] of Object.entries(config.types)) {
    const typeItems = items.filter((i) => i.type === typeName);
    if (typeItems.length === 0) continue;

    lines.push(`## ${typeName}`, "");
    for (const item of typeItems) {
      const title =
        firstString(item.data, ["title", "name", typeConfig.key]) ?? item.path;
      const url = firstString(item.data, ["canonical_url", "url"]);
      const summary = firstString(item.data, ["description", "summary"]);
      let line = `- ${title}`;
      if (url) line += ` (${url})`;
      if (summary) line += `: ${summary}`;
      lines.push(line);
    }
    lines.push("");
  }

  const path = resolve(cwd, config.output, "llms.txt");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, lines.join("\n"), "utf8");
  return path;
}

function firstString(
  data: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
