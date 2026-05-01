import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export class JsonResourceLoader {
  private cache = new Map<string, unknown>();

  async load(ref: string, cwd: string): Promise<unknown> {
    const key = isUrl(ref) ? ref : resolve(cwd, ref);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const value = isUrl(ref)
      ? await fetchJson(ref)
      : await readJsonFile(key);
    this.cache.set(key, value);
    return value;
  }
}

function isUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

async function readJsonFile(absPath: string): Promise<unknown> {
  const raw = await readFile(absPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${absPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
