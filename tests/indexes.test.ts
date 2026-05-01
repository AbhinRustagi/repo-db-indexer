import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Config } from "../src/config/schema.js";
import type { ContentItem } from "../src/content/discover.js";
import { emitIndexes } from "../src/emit/indexes.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-emit-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(rel: string, content: string) {
  const full = join(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

async function readJson(absPath: string): Promise<unknown> {
  return JSON.parse(await readFile(absPath, "utf8"));
}

const postProjection = ["title", "slug", "date"];

const items: ContentItem[] = [
  {
    type: "post",
    path: "posts/a.md",
    format: "markdown-frontmatter",
    data: { title: "A", slug: "a", date: "2024-01-01", body_only: "x" },
    body: "body",
  },
  {
    type: "post",
    path: "posts/b.md",
    format: "markdown-frontmatter",
    data: { title: "B", slug: "b", date: "2024-03-01" },
    body: "body",
  },
];

describe("emitIndexes", () => {
  it("emits a combined index by default with projected items", async () => {
    await write("schemas/post.index.json", JSON.stringify(postProjection));
    const cfg = Config.parse({
      name: "t",
      types: {
        post: {
          content: "posts/**/*.md",
          format: "markdown-frontmatter",
          schema: "ignored",
          projection: "schemas/post.index.json",
          key: "slug",
        },
      },
    });

    const result = await emitIndexes(cfg, items, dir);
    expect(result.written).toEqual([resolve(dir, "index.json")]);
    const combined = (await readJson(result.written[0]!)) as Record<
      string,
      Record<string, unknown>[]
    >;
    expect(combined["post"]).toEqual([
      { title: "A", slug: "a", date: "2024-01-01" },
      { title: "B", slug: "b", date: "2024-03-01" },
    ]);
  });

  it("emits per-type files when type sets index filename", async () => {
    await write("schemas/post.index.json", JSON.stringify(postProjection));
    const cfg = Config.parse({
      name: "t",
      index: { combined: false },
      types: {
        post: {
          content: "posts/**/*.md",
          format: "markdown-frontmatter",
          schema: "ignored",
          projection: "schemas/post.index.json",
          key: "slug",
          index: "posts.json",
        },
      },
    });

    const result = await emitIndexes(cfg, items, dir);
    expect(result.written).toEqual([resolve(dir, "posts.json")]);
    const list = (await readJson(result.written[0]!)) as unknown[];
    expect(list).toHaveLength(2);
  });

  it("sorts items per type sort config", async () => {
    await write("schemas/post.index.json", JSON.stringify(postProjection));
    const cfg = Config.parse({
      name: "t",
      types: {
        post: {
          content: "posts/**/*.md",
          format: "markdown-frontmatter",
          schema: "ignored",
          projection: "schemas/post.index.json",
          key: "slug",
          sort: { field: "date", order: "desc" },
        },
      },
    });

    const result = await emitIndexes(cfg, items, dir);
    const combined = (await readJson(result.written[0]!)) as Record<
      string,
      { slug: string }[]
    >;
    expect(combined["post"]?.map((p) => p.slug)).toEqual(["b", "a"]);
  });

  it("creates output directory if missing", async () => {
    await write("schemas/post.index.json", JSON.stringify(postProjection));
    const cfg = Config.parse({
      name: "t",
      output: "dist/nested",
      types: {
        post: {
          content: "posts/**/*.md",
          format: "markdown-frontmatter",
          schema: "ignored",
          projection: "schemas/post.index.json",
          key: "slug",
        },
      },
    });
    const result = await emitIndexes(cfg, items, dir);
    expect(result.written[0]).toBe(resolve(dir, "dist/nested/index.json"));
    const combined = await readJson(result.written[0]!);
    expect(combined).toHaveProperty("post");
  });
});
