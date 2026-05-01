import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Config, TypeConfig } from "../config/schema.js";
import type { ContentItem } from "../content/discover.js";
import { JsonResourceLoader } from "../validation/schema_loader.js";
import { applyProjection } from "./projection.js";
import { sortItems } from "./sort.js";

export interface EmitResult {
  written: string[];
}

export async function emitIndexes(
  config: Config,
  items: ContentItem[],
  cwd: string
): Promise<EmitResult> {
  const loader = new JsonResourceLoader();
  const written: string[] = [];

  const projectedByType = new Map<string, Record<string, unknown>[]>();
  for (const [typeName, typeConfig] of Object.entries(config.types)) {
    const typeItems = items.filter((i) => i.type === typeName);
    const projection = await loadProjection(loader, typeConfig, cwd);
    const sorted = sortItems(typeItems, typeConfig);
    const projected = sorted.map((item) =>
      applyProjection(item, projection)
    );
    projectedByType.set(typeName, projected);

    if (config.index.per_type || typeConfig.index) {
      const filename = typeConfig.index ?? `${typeName}.json`;
      const out = resolve(cwd, config.output, filename);
      await writeJson(out, projected);
      written.push(out);
    }
  }

  if (config.index.combined) {
    const combined: Record<string, Record<string, unknown>[]> = {};
    for (const [typeName, list] of projectedByType) {
      combined[typeName] = list;
    }
    const out = resolve(cwd, config.output, config.index.file);
    await writeJson(out, combined);
    written.push(out);
  }

  return { written };
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

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}
