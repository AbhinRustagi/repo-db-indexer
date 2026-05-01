import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Config } from "../src/config/schema.js";
import type { ContentItem } from "../src/content/discover.js";
import { emitLlmsTxt } from "../src/emit/llms.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-llms-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const sampleItems: ContentItem[] = [
  {
    type: "post",
    path: "posts/a.md",
    format: "markdown-frontmatter",
    data: {
      title: "Hello",
      slug: "hello",
      canonical_url: "https://x.test/hello",
      description: "A short summary",
    },
    body: "...",
  },
];

function configWithLlms(llms: boolean) {
  return Config.parse({
    name: "blog",
    llms,
    types: {
      post: {
        content: "posts/**/*.md",
        format: "markdown-frontmatter",
        schema: "ignored",
        projection: "ignored",
        key: "slug",
      },
    },
  });
}

describe("emitLlmsTxt", () => {
  it("returns null when llms is disabled", async () => {
    const result = await emitLlmsTxt(configWithLlms(false), sampleItems, dir);
    expect(result).toBeNull();
  });

  it("writes llms.txt with title, url, and summary when enabled", async () => {
    const path = await emitLlmsTxt(configWithLlms(true), sampleItems, dir);
    expect(path).toBe(join(dir, "llms.txt"));
    const out = await readFile(path!, "utf8");
    expect(out).toContain("# blog");
    expect(out).toContain("## post");
    expect(out).toContain("- Hello (https://x.test/hello): A short summary");
  });

  it("falls back to path when no title or key value", async () => {
    const items: ContentItem[] = [
      {
        type: "post",
        path: "posts/no-title.md",
        format: "markdown-frontmatter",
        data: { slug: "x" },
      },
    ];
    const path = await emitLlmsTxt(configWithLlms(true), items, dir);
    const out = await readFile(path!, "utf8");
    expect(out).toContain("- x");
  });
});
