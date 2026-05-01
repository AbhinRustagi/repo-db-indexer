import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Config } from "../config/schema.js";
import type { ContentItem } from "../content/discover.js";

const START_MARKER = "<!-- repo-db-indexer:start -->";
const END_MARKER = "<!-- repo-db-indexer:end -->";

export async function emitReadme(
  config: Config,
  items: ContentItem[],
  cwd: string
): Promise<string | null> {
  if (!config.update_readme) return null;

  const generated = buildBlock(config, items);
  const readmePath = resolve(cwd, config.output, "README.md");

  let existing = "";
  try {
    existing = await readFile(readmePath, "utf8");
  } catch {
    // File does not exist; we'll create it
  }

  const next = mergeBlock(existing, generated, config.name);
  await writeFile(readmePath, next, "utf8");
  return readmePath;
}

function buildBlock(config: Config, items: ContentItem[]): string {
  const lines: string[] = [START_MARKER, ""];
  for (const [typeName, typeConfig] of Object.entries(config.types)) {
    const typeItems = items.filter((i) => i.type === typeName);
    if (typeItems.length === 0) continue;
    lines.push(`## ${typeName}`, "");
    for (const item of typeItems) {
      const title =
        firstString(item.data, ["title", "name", typeConfig.key]) ?? item.path;
      lines.push(`- [${title}](${item.path})`);
    }
    lines.push("");
  }
  lines.push(END_MARKER);
  return lines.join("\n");
}

function mergeBlock(existing: string, block: string, fallbackTitle: string): string {
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  if (start !== -1 && end !== -1 && end > start) {
    return (
      existing.slice(0, start) +
      block +
      existing.slice(end + END_MARKER.length)
    );
  }
  if (existing.trim().length > 0) {
    return existing.trimEnd() + "\n\n" + block + "\n";
  }
  return `# ${fallbackTitle}\n\n${block}\n`;
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
